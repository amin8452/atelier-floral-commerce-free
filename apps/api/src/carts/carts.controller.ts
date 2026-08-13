import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { AddCartItemDto, UpdateCartItemDto } from "./cart.dto.js";
import { requireCartToken } from "./cart-token.js";
import { CartsService } from "./carts.service.js";

@Controller("carts")
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Post() create() { return this.carts.create(); }
  @Get("current") get(@Headers("x-cart-token") token: string | undefined) { return this.carts.get(requireCartToken(token)); }

  @Post("items")
  @UseGuards(AdminOriginGuard)
  add(@Headers("x-cart-token") token: string | undefined, @Body() dto: AddCartItemDto) {
    return this.carts.add(requireCartToken(token), dto);
  }

  @Patch("items/:id")
  @UseGuards(AdminOriginGuard)
  update(@Headers("x-cart-token") token: string | undefined, @Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCartItemDto) {
    return this.carts.update(requireCartToken(token), id, dto.quantity);
  }

  @Delete("items/:id")
  @UseGuards(AdminOriginGuard)
  remove(@Headers("x-cart-token") token: string | undefined, @Param("id", ParseUUIDPipe) id: string) {
    return this.carts.remove(requireCartToken(token), id);
  }
}
