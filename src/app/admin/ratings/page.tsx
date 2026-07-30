import { redirect } from 'next/navigation';

export default function LegacyRatingsPage(){
  redirect('/admin/reviews?tab=ratings');
}
