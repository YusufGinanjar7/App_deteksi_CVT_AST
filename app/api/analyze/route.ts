import { NextResponse } from 'next/server';
import { client, handle_file } from '@gradio/client';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("Content-Type") || 'audio/webm';
    const extension = contentType.includes('mp4') ? 'mp4' : contentType.includes('wav') ? 'wav' : 'webm';
    
    const arrayBuffer = await req.arrayBuffer();
    const audioFile = new File([arrayBuffer], `rekaman.${extension}`, { type: contentType });

    // 1. Hubungkan ke Space dengan memasukkan Token HF
    const app = await client("suyagi/NEW_AST_FINAL", {
      hf_token: process.env.HF_TOKEN
    } as any);

    // 2. Tembak API Gradio
    const result = await app.predict("/prediksi", [
        handle_file(audioFile) 
    ]);

    const outputData = result.data as any[];
    
    let formattedResult = [];
    if (outputData[0] && outputData[0].confidences) {
        formattedResult = outputData[0].confidences.map((c: any) => ({
            label: c.label,
            score: c.confidence 
        }));
    } else {
        const dict = outputData[0];
        formattedResult = Object.keys(dict).map(key => ({
            label: key,
            score: dict[key]
        }));
    }

    return NextResponse.json(formattedResult, { status: 200 });

  } catch (error: any) {
    console.error("============= ERROR DARI GRADIO =============");
    console.error(error);
    return NextResponse.json({ error: "Gagal memproses via Space." }, { status: 500 });
  }
}