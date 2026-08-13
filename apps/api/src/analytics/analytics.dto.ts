import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { AnalyticsEventType } from "../generated/prisma/enums.js";
import { PaginationDto } from "../common/pagination/pagination.dto.js";

const PUBLIC_EVENTS = [AnalyticsEventType.PRODUCT_VIEW, AnalyticsEventType.WHATSAPP_CLICK] as const;

export class CreateAnalyticsEventDto {
  @IsIn(PUBLIC_EVENTS) type!: typeof AnalyticsEventType.PRODUCT_VIEW | typeof AnalyticsEventType.WHATSAPP_CLICK;
  @IsUUID() productId!: string;
  @IsOptional() @IsString() @MaxLength(128) sessionId?: string;
}

export class ProductPerformanceQueryDto extends PaginationDto {}

export class DashboardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(90)
  days = 30;
}
