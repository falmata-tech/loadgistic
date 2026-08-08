import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { saveUpload, transitionShipment } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';
import { revalidatePath } from 'next/cache';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login',request.url),303);
  const { id } = await params;
  const form = await request.formData();
  try {
    const nextStatus=text(form,'nextStatus');
    const proofTypeByStatus:Record<string,string>={ASSIGNED:'LOADING',DELIVERED:'UNLOADING',ISSUE:'ISSUE'};
    const proofFile=form.get('proof');
    if(proofFile&&typeof proofFile!=='string'&&proofFile.size&&!proofTypeByStatus[nextStatus])throw new Error('INVALID_PROOF_TYPE');
    const upload=await saveUpload(proofFile,'tracking-proof');
    transitionShipment(user,id,nextStatus,text(form,'note'),upload?{upload,proofType:proofTypeByStatus[nextStatus]}:null);
    revalidatePath('/app/shipments');
    revalidatePath(`/app/shipments/${id}`);
    return redirectWith(request,`/app/shipments/${id}`,'success','Shipment status updated.');
  } catch (error) {
    return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));
  }
}
