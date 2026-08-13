import { ProductEditor } from "@/features/admin/product-editor";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ProductEditor id={id} />; }
