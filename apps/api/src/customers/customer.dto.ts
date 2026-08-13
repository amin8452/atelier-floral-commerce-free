import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationDto } from "../common/pagination/pagination.dto.js";

export class CustomerQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
