import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { DiscountType } from "../generated/prisma/enums.js";
import { MONEY_PATTERN } from "../common/validation/patterns.js";

export class CreatePromotionDto {
  @IsString() @MaxLength(160) name!: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]+$/) @MaxLength(80) code!: string;
  @IsEnum(DiscountType) discountType!: DiscountType;
  @Matches(MONEY_PATTERN) discountValue!: string;
  @IsOptional() @Matches(MONEY_PATTERN) minimumAmount?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) usageLimit?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
}

export class UpdatePromotionDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]+$/) @MaxLength(80) code?: string;
  @IsOptional() @IsEnum(DiscountType) discountType?: DiscountType;
  @IsOptional() @Matches(MONEY_PATTERN) discountValue?: string;
  @IsOptional() @Matches(MONEY_PATTERN) minimumAmount?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) usageLimit?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() startsAt?: Date;
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;
}
