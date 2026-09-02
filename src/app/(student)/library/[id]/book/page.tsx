import { redirect } from "next/navigation";

type BookingCheckoutPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BookingCheckoutPage({ params }: BookingCheckoutPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  if (id) {
    redirect(`/library/${id}?embed=true#booking-widget`);
  }
  
  return null;
}
