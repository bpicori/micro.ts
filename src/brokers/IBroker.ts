import { BaseRouteDefinition, Action } from "../server/types/BaseTypes";

export type RouteMapper = (def: BaseRouteDefinition) => string;
export type RequestMapper = (...input: any[]) => Action;

export interface BrokerConnection<T> {
    connection: T;
}

export interface IBroker {
    addRoute(def: BaseRouteDefinition, handler: (action: Action) => any): string | Promise<string>;
    setRequestMapper(requestMapper: RequestMapper): void;
    setRouteMapper(setRouteMapper: RouteMapper): void;

    /**
     * Starts the broker connection
     */
    start(): Promise<void>;
}
