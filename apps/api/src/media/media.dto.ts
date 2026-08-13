import { IsString, MaxLength, MinLength } from "class-validator";

export class UploadMediaDto {
  @IsString() @MinLength(1) @MaxLength(260) altText!: string;
}
