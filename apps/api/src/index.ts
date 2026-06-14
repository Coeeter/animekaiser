import { HttpRouter, HttpServer, HttpServerResponse } from "@effect/platform"
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Layer from "effect/Layer"

const router = HttpRouter.empty.pipe(
  HttpRouter.get("/", HttpServerResponse.text("Hello World!"))
)

const app = router.pipe(HttpServer.serve(), HttpServer.withLogAddress)

const port = 8080

const ServerLive = BunHttpServer.layer({ port })

BunRuntime.runMain(Layer.launch(Layer.provide(app, ServerLive)))
