import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min, ValidateIf } from "class-validator";

const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{5,38}$/;

export class UpdateSettingsDto {
  @IsOptional() @IsString() @MaxLength(160) storeName?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsEmail() @MaxLength(254) storeEmail?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsEmail() @MaxLength(254) supportEmail?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @Matches(PHONE_PATTERN) @MaxLength(40) whatsappNumber?: string | null;
  @IsOptional() @IsString() @Length(3, 3) defaultCurrency?: string;
  @IsOptional() @IsString() @MaxLength(20) defaultLocale?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(500) address?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @Length(2, 2) country?: string | null;
  @IsOptional() @IsBoolean() shippingEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) shippingFlatRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(1) taxRate?: number;
  @IsOptional() @IsBoolean() codEnabled?: boolean;
  @IsOptional() @IsBoolean() onlinePaymentEnabled?: boolean;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUrl({ require_protocol: true }) instagramUrl?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUrl({ require_protocol: true }) facebookUrl?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUrl({ require_protocol: true }) heroImageUrl?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUrl({ require_protocol: true }) storyImageUrl?: string | null;
}
