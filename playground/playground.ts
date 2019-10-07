import { Required, MinLength, getSchema } from "joi-typescript-validator";
import { Service } from "../src/di/DiDecorators";
import { JsonController, ControllerAuthorize, BeforeMiddlewares, ControllerFilterBroker } from "../src/decorators/ControllerDecorators";
import { Get, Delete, Post } from "../src/decorators/RestDecorators";
import { Action, BaseRouteDefinition } from "../src/server/types/BaseTypes";
import { IMiddleware } from "../src/middlewares/IMiddleware";
import { IBroker } from "../src/brokers/IBroker";
import { Container } from "../src/di/BaseContainer";
import { UseMiddlewares, AllowAnonymous, FilterBrokers } from "../src/decorators/MethodDecorators";
import { Query, Headers, Header, Connection, Request } from "../src/decorators/ParameterDecorators";
import { AuthorizeOptions } from "../src/decorators/types/MethodMetadataTypes";
import { BaseServer } from "../src/server/BaseServer";
import { DefinitionHandlerPair } from "../src/brokers/AbstractBroker";
import { AmqpBroker } from "../src/brokers/AmqpBroker";
import { HapiBroker } from "../src/brokers/HapiBroker";
import { SocketIOBroker } from "../src/brokers/SocketIOBroker";
import * as Joi from 'joi';
import { NotFound } from "../src/errors/MainAppErrror";

class User {
    @Required()
    @MinLength(3)
    public name!: string;
}

@Service()
class UserService {
    private data: any[] = [];

    getData() {
        return this.data;
    }

    setData(headers: any) {
        this.data.push(headers);
    }
}
@JsonController("Thrive")
@ControllerFilterBroker((broker: IBroker) => broker.constructor.name === 'SocketIOBroker')
export class Thrive {

    constructor() { }
    @Get({ consumers: 20 })
    getTrafficSources() { }
}

function beforeMiddleWare(a: Action) {
    a.request.qs = { num: Math.random(), value: (Math.random() < 0.5) ? true : false, ...a.request.qs }; return a;
}

@Service()
class TrackerMiddleware implements IMiddleware {
    constructor() { }
    num: number = 0;
    do(action: Action, def?: BaseRouteDefinition | undefined, controller?: VoluumController, broker?: IBroker): Action | Promise<Action> {
        controller!.login(this.num);
        this.num++;
        return action;
    }
}

@JsonController("Voluum")
@ControllerAuthorize()
@BeforeMiddlewares([Container.get(TrackerMiddleware)])
export class VoluumController {
    constructor(private serv: UserService) {
    }

    public login(num: number) {
        console.log("Called login " + num);
    };

    @Get()
    @UseMiddlewares([{
        before: true,
        middleware: beforeMiddleWare
    }])
    @AllowAnonymous()
    @FilterBrokers((broker: IBroker) => { return broker.constructor.name !== 'HapiBroker' })
    public async trafficSources(@Request() req: Action,
        @Query() query: any,
        @Headers() _headers: any,
        @Header("socket_id", { required: true }) socket_id: string,
        @Connection() con: any) {
        this.serv.setData({ socket_id });
        con.emit(req.request.body.reply_to, this.serv.getData());
        return this.serv.getData();
    }

    @Get({ consumers: 2 })
    public async trackerView() {
        throw new NotFound();
    }

    @Post({ path: "clear" })
    @AllowAnonymous()
    public async removeData(@Query({ required: true, validate: true }) data: User) {
        return { data };
    }

    @Delete({ path: "clear-all" })
    public async removeAllData() {

    }
}

async function main() {
    const HapiConfig = { address: '0.0.0.0', port: 8080 };
    const AmqpConfig = { url: 'amqp://localhost' };
    const hapi = new HapiBroker(HapiConfig);
    const amqp = new AmqpBroker(AmqpConfig)
    const socket = new SocketIOBroker(hapi.getConnection().listener);
    socket.setRouteMapper((def: BaseRouteDefinition) => {
        return def.handler;
    })
    amqp.setRouteMapper((def: BaseRouteDefinition) => {
        return `ms.Tracker.${def.controller}`
    });
    amqp.setActionToHandlerMapper((_route: string, action: Action, pairs: DefinitionHandlerPair[]) => {
        const body = action.request.body;
        const method = body.method;
        let filtered = pairs.find(x => x.def.handlerName === method);
        if (!filtered) {
            filtered = pairs[0];
        }
        action.request.method = filtered.def.method;
        return filtered.handler;
    });

    const server = new BaseServer({
        controllers: [VoluumController, Thrive],
        brokers: [hapi, socket],
        logRequests: true,
        basePath: 'api',
        dev: true,
        validateFunction: (value: any, type: any) => {
            const schema = getSchema(type);
            return Joi.validate(value, schema);
        },
        afterMiddlewares: [(action: Action) => {
            action.response = action.response || {};
            const currentBody = action.response.body;
            action.response.body = { ok: true, result: currentBody };
            return action;
        }],
        currentUserChecker: (a: Action) => { return {}; },
        authorizationChecker: (_a: Action, _options?: AuthorizeOptions) => { return false; }
    });
    await server.start();
}
main().catch(console.log);
