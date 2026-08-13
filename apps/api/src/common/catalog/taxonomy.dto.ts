import { PartialType } from "@nestjs/mapped-types";
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { SLUG_PATTERN } from "../validation/patterns.js";

export class CreateTaxonomyDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @Matches(SLUG_PATTERN) @MaxLength(160) slug!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateTaxonomyDto extends PartialType(CreateTaxonomyDto) {}
