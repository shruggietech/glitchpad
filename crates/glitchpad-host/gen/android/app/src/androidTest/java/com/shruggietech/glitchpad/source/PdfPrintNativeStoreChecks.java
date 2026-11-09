package com.shruggietech.glitchpad.source;

import android.content.Context;
import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.util.UUID;
import org.json.JSONObject;
import static org.junit.Assert.*;

/** Exercises production private-file validation independently of the web transport. */
public final class PdfPrintNativeStoreChecks {
  private static PdfPrintArgs args() {PdfPrintArgs value=new PdfPrintArgs();value.setRequestId(UUID.randomUUID().toString());value.setOwner("native-store-fixture");value.setPageCount(1);return value;}
  private static void refused(Runnable action){try{action.run();fail("Invalid native print operation was accepted");}catch(IllegalStateException expected){}}
  public static JSONObject verify(Context context) throws Exception {
    File root=new File(context.getCacheDir(),"pdf-print-check-"+UUID.randomUUID());assertTrue(root.mkdir());
    try {
      PdfPrintStore store=new PdfPrintStore(root);PdfPrintArgs request=args();store.begin(request);
      Bitmap bitmap=Bitmap.createBitmap(16,16,Bitmap.Config.ARGB_8888);bitmap.eraseColor(android.graphics.Color.BLUE);ByteArrayOutputStream bytes=new ByteArrayOutputStream();assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG,100,bytes));bitmap.recycle();byte[] png=bytes.toByteArray();int[] integers=new int[png.length];for(int index=0;index<png.length;index++)integers[index]=png[index]&255;
      request.setBytes(integers);store.append(request);request.setWidth(16.3);request.setHeight(15.5);assertEquals("ready",store.seal(request).getString("status"));
      PdfPrintArgs wrong=args();wrong.setRequestId(request.getRequestId());wrong.setOwner("different-owner");refused(()->store.status(wrong));refused(()->store.begin(args()));
      assertEquals("cancelled",store.cancel(request).getString("status"));assertFalse(new File(root,request.getRequestId()).exists());
      PdfPrintArgs partial=args();store.begin(partial);partial.setBytes(new int[262145]);refused(()->store.append(partial));partial.setBytes(new int[]{1,2,3});store.append(partial);partial.setWidth(16);partial.setHeight(16);refused(()->store.seal(partial));store.cancel(partial);assertFalse(new File(root,partial.getRequestId()).exists());
      File owned=new File(root,UUID.randomUUID().toString());assertTrue(owned.mkdir());File stale=new File(owned,"page-0.png");try(FileOutputStream out=new FileOutputStream(stale)){out.write(png);}File foreign=new File(root,"keep.txt");assertTrue(foreign.createNewFile());new PdfPrintStore(root);assertFalse(owned.exists());assertTrue(foreign.exists());
      return new JSONObject().put("real_private_io",true).put("sealed_png_validation",true).put("cross_owner_refused",true).put("concurrent_job_refused",true).put("chunk_limit_refused",true).put("invalid_png_refused",true).put("partial_cancel_cleanup",true).put("owned_restart_cleanup",true);
    } finally {remove(root);}
  }
  private static void remove(File path){File[] children=path.listFiles();if(children!=null)for(File child:children)remove(child);path.delete();}
  private PdfPrintNativeStoreChecks(){}
}
