import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { LeadSource, LeadStatus, PreferredContactMethod } from "../generated/prisma/enums.js";
import { PaginationDto } from "../common/pagination/pagination.dto.js";

const PHONE_PATTERN = /^\+?[0-9][0-9\s().-]{5,38}$/;

export class CreateLeadDto {
  @IsString() @IsNotEmpty() @MaxLength(80) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) lastName!: string;
  @IsString() @Matches(PHONE_PATTERN) @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsUUID() productVariantId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) quantity!: number;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsEnum(PreferredContactMethod) preferredContactMethod!: PreferredContactMethod;
  @IsBoolean() consentToContact!: boolean;
}

export class CreateContactDto {
  @IsString() @IsNotEmpty() @MaxLength(80) firstName!: string;
  @IsString() @IsNotEmpty() @MaxLength(80) lastName!: string;
  @IsString() @Matches(PHONE_PATTERN) @MaxLength(40) phone!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsString() @IsNotEmpty() @MaxLength(180) subject!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) message!: string;
  @IsEnum(PreferredContactMethod) preferredContactMethod!: PreferredContactMethod;
  @IsBoolean() consentToContact!: boolean;
}

export class LeadQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsEnum(LeadSource) source?: LeadSource;
  @IsOptional() @IsString() @MaxLength(120) search?: string;
}

export class UpdateLeadDto {
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsUUID() assignedToId?: string;
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(2000) note?: string;
}
