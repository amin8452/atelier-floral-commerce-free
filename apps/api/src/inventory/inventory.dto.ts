import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import { PaginationDto } from "../common/pagination/pagination.dto.js";
import { parseBooleanQuery } from "../common/validation/transforms.js";

export class InventoryQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Transform(({ value }) => parseBooleanQuery(value)) @IsBoolean() lowStockOnly?: boolean;
}

export class SetStockDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() variantId?: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) stock!: number;
}
