import {HttpBroker, HttpVerbs, IHttpListnerConfig} from "../HttpBroker";
import koa from 'koa'
import Router from 'koa-router';
import bodyParser from "koa-bodyparser";
import {Action} from "../../../server/types";
import {DefinitionHandlerPair} from "../../AbstractBroker";
import {IConfiguration} from "../../../server/IConfiguration";

export class KoaBroker extends HttpBroker<koa, koa.Context, koa.Context, IHttpListnerConfig> {
  private readonly router: Router;
  constructor(config: IConfiguration){
   super(config);
   this.server = new koa();
   this.router = new Router();
  }
  protected paramWrapper(paramName: string): string {
    return `:${paramName}`;
  }

  protected respond(result: Action, ctx: koa.Context) {
    const body = result.response!.body || result.response!.error;
    const headers = result.response!.headers || {};
    ctx.status = result.response!.statusCode || 200;
    ctx.body = body;
    ctx.set(headers);
    return ctx;
  }

  protected registerHandler(value: DefinitionHandlerPair[], route: string, method: HttpVerbs): void {
    this.router[method](route, async (ctx: koa.Context): Promise<any> =>{
      const action = this.requestMapper(ctx);
      const handler = this.actionToRouteMapper(route, action, value);
      const result: Action = await handler(action);
      result.response = result.response || {};
      return this.respond(result, ctx);
    })
  }

  protected requestMapper: (r: koa.Context) => Action = (r: koa.Context)=>{
    const action: Action = {
      request: {
        headers: r.headers,
        body: r.request.body,
        method: r.method,
        qs: r.query,
        params: r.params,
        raw: r,
        path: r.path
      },
      connection: r.app
    };
    return action;  };

  async start(): Promise<void> {
    this.registerRoutes();
    this.server.use(bodyParser());
    this.server.use(this.router.routes());
    this.server.listen(this.config.port as number, this.config.address as string);
    console.log(`Server listening on address ${this.config.address} and port ${this.config.port}`);
  }


}
