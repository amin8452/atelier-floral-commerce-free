import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "../generated/prisma/enums.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CustomerQueryDto } from "./customer.dto.js";
import { CustomersService } from "./customers.service.js";

@Controller("customers/admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORDER_MANAGER, UserRole.SUPPORT)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() query: CustomerQueryDto) { return this.customers.list(query); }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) { return this.customers.get(id); }
}
