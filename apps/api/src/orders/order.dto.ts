import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MaxLength, MinLength, ValidateNested } from "class-validator";
import { FulfillmentStatus, PaymentMethod, PaymentStatus } from "../generated/prisma/enums.js";

const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{5,38}$/;

export class CheckoutCustomerDto {
  @IsString() @MinLength(1) @MaxLength(80) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(80) lastName!: string;
  @IsString() @Matches(PHONE_PATTERN) @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}

export class CheckoutAddressDto {
  @IsString() @MinLength(1) @MaxLength(220) line1!: string;
  @IsOptional() @IsString() @MaxLength(220) line2?: string;
  @IsString() @MinLength(1) @MaxLength(120) city!: string;
  @IsOptional() @IsString() @MaxLength(30) postalCode?: string;
  @IsString() @Length(2, 2) country!: string;
}

export class CheckoutDto {
  @ValidateNested() @Type(() => CheckoutCustomerDto) customer!: CheckoutCustomerDto;
  @ValidateNested() @Type(() => CheckoutAddressDto) shippingAddress!: CheckoutAddressDto;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsString() @MaxLength(80) promotionCode?: string;
  @IsEnum(PaymentMethod) paymentMethod!: PaymentMethod;
}

export class UpdateOrderStatusDto {
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsEnum(FulfillmentStatus) fulfillmentStatus?: FulfillmentStatus;
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}
