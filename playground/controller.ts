import {Body, Get, Headers, JsonController, Params} from "../src/decorators";
import {Required, ValidOptions} from "joi-typescript-validator/lib";

class ParamsRequest {
  @Required()
  @ValidOptions('mobile', 'adult', 'native')
  platform!: string;
  @Required()
  userId!: number;
}

@JsonController("test")
export class TestController {

  @Get("parameter/:platform/:userId", {queueOptions: {autoDelete: true, durable: false}})
  public parameterTest(@Params({validate: true}) params: ParamsRequest, @Body({notEmpty: false}) body: any,
                       @Headers() headers: any) {
    return {body, params}
  }

}
