import { Type } from "class-transformer";
import { IsInt, IsObject, IsOptional, IsUUID, Max, Min } from "class-validator";

export class AddCartItemDto {
  @IsUUID() productId!: string;
  @IsOptional() @IsUUID() variantId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity!: number;
  @IsOptional() @IsObject() personalization?: Record<string, string>;
}

export class UpdateCartItemDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity!: number;
}
