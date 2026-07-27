import { useEffect, useRef } from 'react';
import grapesjs from 'grapesjs';
import presetNewsletter from 'grapesjs-preset-newsletter';
import 'grapesjs/dist/css/grapes.min.css';
import api from '../../api/axios';

const API = '/api/campaigns/templates.php';

/**
 * Drag-and-drop email builder — GrapesJS + its "newsletter" preset (self-hosted npm
 * packages, same self-hosted-over-cloud approach as the TinyMCE editor mode elsewhere
 * in this file: no external API key, works fully offline). The preset ships the block
 * palette (columns, text, image, button, divider, social...), a style/trait manager,
 * layer manager, code view, and — critically for email — a `gjs-get-inlined-html`
 * command that walks the CSS the user built up in the Style Manager and inlines it
 * onto each element's `style=""` attribute via juice, since most mail clients strip
 * <style> blocks entirely.
 *
 * `onReady(editor)` hands the live GrapesJS instance up to the parent so its own Save
 * button (in TemplateEditor's TopBar) can call `editor.runCommand('gjs-get-inlined-html')`
 * to get the final, portable HTML string at save time.
 */
export default function EmailBuilder({ initialHtml, onReady, onDirty }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const editor = grapesjs.init({
      container: containerRef.current,
      height: '100%',
      width: 'auto',
      fromElement: false,
      storageManager: false,
      plugins: [presetNewsletter],
      pluginsOpts: {
        [presetNewsletter]: {
          modalTitleImport: 'Import template',
          modalTitleExport: 'Preview HTML',
        },
      },
      assetManager: {
        // Wired to the same upload_image action the rich-text editor uses — dropping/
        // picking an image here uploads it and inserts a real hosted <img src="...">,
        // not a giant inline base64 blob most mail clients strip or choke on.
        uploadFile: (e) => {
          const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
          const file = files && files[0];
          if (!file) return;
          const fd = new FormData();
          fd.append('action', 'upload_image');
          fd.append('image', file);
          api.post(API, fd, { headers: { 'Content-Type': undefined } }).then((res) => {
            if (res.data?.success && res.data?.data?.location) {
              editor.AssetManager.add(res.data.data.location);
            }
          });
        },
      },
    });

    // Waits for the canvas iframe itself to finish loading before touching it — importing
    // components (or reaching into the iframe's own body) before 'load' fires is a race.
    editor.on('load', () => {
      if (initialHtml && initialHtml.trim()) editor.setComponents(initialHtml);

      // Fills in a background/min-height default so the canvas doesn't look like bare white
      // space with nothing to click on — full width by default (not a narrow fixed email
      // column), and only fills gaps, never overwrites a width/background already customized.
      const canvasBody = editor.Canvas.getBody();
      if (canvasBody) canvasBody.style.background = '#e8e9f5';
      const wrapper = editor.getWrapper();
      const existing = wrapper.getStyle() || {};
      wrapper.setStyle({
        ...existing,
        'max-width': existing['max-width'] || '100%',
        margin: existing.margin || '0',
        background: existing.background || '#ffffff',
        'min-height': existing['min-height'] || '300px',
      });
    });
    editor.on('component:update component:add component:remove style:update', () => onDirty?.());
    onReady?.(editor);

    return () => editor.destroy();
  }, []); // eslint-disable-line

  return <div ref={containerRef} style={{ height: '100%' }} />;
}
