import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { ProductStatus } from "../generated/prisma/enums.js";
import { PaginationDto } from "../common/pagination/pagination.dto.js";
import { MONEY_PATTERN, SLUG_PATTERN } from "../common/validation/patterns.js";
import { parseBooleanQuery } from "../common/validation/transforms.js";

export enum ProductSort {
  NEWEST = "newest",
  PRICE_ASC = "price_asc",
  PRICE_DESC = "price_desc",
  POPULAR = "popular",
}

export class ProductQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() @MaxLength(160) category?: string;
  @IsOptional() @IsString() @MaxLength(160) collection?: string;
  @IsOptional() @Matches(MONEY_PATTERN) minPrice?: string;
  @IsOptional() @Matches(MONEY_PATTERN) maxPrice?: string;
  @IsOptional() @Transform(({ value }) => parseBooleanQuery(value)) @IsBoolean() available?: boolean;
  @IsOptional() @IsEnum(ProductSort) sort: ProductSort = ProductSort.NEWEST;
}

export class AdminProductQueryDto extends ProductQueryDto {
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
}

export class ProductVariantInputDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @MinLength(1) @MaxLength(180) name!: string;
  @IsString() @MinLength(1) @MaxLength(100) sku!: string;
  @IsObject() options!: Record<string, string>;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @Matches(MONEY_PATTERN) price?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @Matches(MONEY_PATTERN) salePrice?: string | null;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) stock!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProductImageInputDto {
  @IsUUID() assetId!: string;
  @IsOptional() @IsUUID() variantId?: string;
  @IsString() @MinLength(1) @MaxLength(260) altText!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000) sortOrder!: number;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateProductDto {
  @IsString() @MinLength(1) @MaxLength(180) name!: string;
  @IsString() @Matches(SLUG_PATTERN) @MaxLength(180) slug!: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(400) shortDescription?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(20_000) description?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(100) sku?: string | null;
  @Matches(MONEY_PATTERN) basePrice!: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @Matches(MONEY_PATTERN) salePrice?: string | null;
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) stock!: number;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUUID() categoryId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID("4", { each: true }) collectionIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(60, { each: true }) tags?: string[];
  @IsOptional() @IsObject() personalizationSchema?: Record<string, unknown>;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(180) metaTitle?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(320) metaDescription?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProductVariantInputDto) variants?: ProductVariantInputDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProductImageInputDto) images?: ProductImageInputDto[];
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(180) name?: string;
  @IsOptional() @IsString() @Matches(SLUG_PATTERN) @MaxLength(180) slug?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(400) shortDescription?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(20_000) description?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(100) sku?: string | null;
  @IsOptional() @Matches(MONEY_PATTERN) basePrice?: string;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @Matches(MONEY_PATTERN) salePrice?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000) stock?: number;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsUUID() categoryId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID("4", { each: true }) collectionIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(60, { each: true }) tags?: string[];
  @IsOptional() @IsObject() personalizationSchema?: Record<string, unknown>;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(180) metaTitle?: string | null;
  @IsOptional() @ValidateIf((_object, value) => value !== null) @IsString() @MaxLength(320) metaDescription?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProductVariantInputDto) variants?: ProductVariantInputDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ProductImageInputDto) images?: ProductImageInputDto[];
}
