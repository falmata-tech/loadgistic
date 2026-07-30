import { redirect } from 'next/navigation';

export default function LegacyVerificationsPage(){
  redirect('/admin/reviews?tab=documents');
}
