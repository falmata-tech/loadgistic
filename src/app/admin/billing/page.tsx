import { redirect } from 'next/navigation';

export default function LegacyBillingPage(){
  redirect('/admin/reviews?tab=payments');
}
