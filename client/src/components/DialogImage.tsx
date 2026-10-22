import { h, Fragment } from '../runtime.js';
import { OGDialog, OGDialogContent, useLocalize } from '../runtime.js';

/** The card's image preview: full-size picture plus a download action. */
export default function DialogImage({ isOpen, onOpenChange, src, downloadImage, alt }) {
  const localize = useLocalize();
  return (
    <OGDialog open={isOpen} onOpenChange={onOpenChange}>
      <OGDialogContent className="max-w-[90vw] p-3" showCloseButton>
        <img src={src} alt={alt ?? ''} className="max-h-[78vh] w-full rounded-lg object-contain" />
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={downloadImage}
            className="rounded-lg border border-border-light px-3 py-1.5 text-sm text-text-primary hover:bg-surface-tertiary"
          >
            {localize('com_ui_download')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
}
