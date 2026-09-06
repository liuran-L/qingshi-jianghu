export function ReturnJourneyActions({onCancel,onConfirm,busy}:{onCancel:()=>void;onConfirm:()=>void;busy:boolean}) {
 return <div className="flex justify-end gap-3">
  <button type="button" className="art-learn" onClick={onCancel}>取消</button>
  <button type="button" className="art-learn disabled:opacity-50" onClick={onConfirm} disabled={busy}>确定</button>
 </div>;
}
