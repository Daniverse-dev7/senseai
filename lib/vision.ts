export type Detection = {class:string; score:number; bbox:[number,number,number,number]};
export function position(d:Detection,width:number){const center=(d.bbox[0]+d.bbox[2]/2)/width;return center<1/3?'left':center>2/3?'right':'center';}
export function answer(question:string,items:Detection[],width:number,text:string){
 const q=question.toLowerCase();
 if(/distance|safe|navigate/.test(q))return 'I cannot estimate physical distance or safety from this camera. SenseAI is not a navigation system.';
 if(/read|text|ocr/.test(q))return text||'No text has been captured yet. Use Read text to recognize a camera frame.';
 const target=items.filter(d=>q.includes(d.class.toLowerCase())||(d.class==='person'&&/people|person/.test(q)));
 if(/where/.test(q))return target.length?target.map(d=>`The ${d.class} is toward the ${position(d,width)} of the frame (${Math.round(d.score*100)}% confidence).`).join(' '):'That object is not in the current detections. It may be outside the frame or unrecognized.';
 if(/how many|count/.test(q))return `I currently detect ${target.length||(!/people|person/.test(q)&&!target.length?items.length:0)} matching objects. Detection can miss or misclassify objects.`;
 if(/see|object|visible|scene/.test(q))return items.length?`The detector identifies ${items.map(d=>`${d.class} (${position(d,width)})`).join(', ')}. This is an object summary, not full scene reasoning.`:'No objects are currently detected. Start the camera and wait for the model.';
 return 'I can summarize detected objects, count people, locate an object, or read captured text. General visual reasoning requires a configured vision-language provider.';
}
export function cameraError(error:unknown){const name=error instanceof Error?error.name:'';return name==='NotAllowedError'?'Camera permission was denied. Allow camera access in your browser settings and try again.':name==='NotFoundError'?'No camera was found. Connect a webcam or try a device with a camera.':name==='NotReadableError'?'The camera is busy or unavailable. Close other camera apps and try again.':'Unable to start the camera. Check browser permissions and use HTTPS or localhost.';}
