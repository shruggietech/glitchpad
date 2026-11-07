import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../apps/glitchpad/src/runtime-polyfills';
import '../../apps/glitchpad/src/styles.css';
import { AppFrame } from '../../brand/web/react/server';
import { AppFrameHostBridge } from '../../apps/glitchpad/src/components/AppFrameHostBridge';
import { AppFrameEnvironmentBridge } from '../../brand/web/react/environment';
import { DiagramViewport } from '../../apps/glitchpad/src/components/DiagramViewport';
import { ImageSurface } from '../../apps/glitchpad/src/components/ImageSurface';
import type {
  ImageDescriptor,
  ImageFamilyState,
} from '../../apps/glitchpad/src/domain/image-contract';
import type { ImageGateway } from '../../apps/glitchpad/src/domain/image-gateway';
import {
  noSourceCapabilities,
  type SourceDescriptor,
} from '../../apps/glitchpad/src/domain/contracts';
import { createImageSession } from '../../apps/glitchpad/src/domain/image-contract';
const family = new URLSearchParams(location.search).get('family') || 'diagram';
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="1000"><rect width="3000" height="1000" fill="blue"/></svg>';
const authority: SourceDescriptor = {
  kind: 'memory',
  display_name: 'Synthetic image',
  identity: {
    authority: 'synthetic',
    scope: 'image-layout',
    token: 'layout',
    strength: 'strong',
  },
  claimed_media_type: 'image/png',
  byte_length: 128,
  modified_unix_ms: null,
  capabilities: { ...noSourceCapabilities(), read: true, metadata: true },
};
const initial = createImageSession(
  authority,
  'layout-source',
  {
    identity: authority.identity,
    byte_length: 128,
    modified_unix_nanos: null,
    change_token: null,
  },
  family === 'animation'
    ? 'gif'
    : family === 'ico'
      ? 'ico'
      : family === 'svg'
        ? 'svg'
        : 'png',
  'layout',
);
initial.lifecycle = 'active';
const gateway: ImageGateway = {
  render: async (session) => {
    const selection = session.image_document.selection ?? 0;
    const canvas = document.createElement('canvas');
    canvas.width = family === 'ico' ? 256 : 3000;
    canvas.height = family === 'ico' ? 256 : 1000;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = selection % 2 ? 'blue' : 'red';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const bytes = Uint8Array.from(
      atob(canvas.toDataURL('image/png').split(',')[1]),
      (c) => c.charCodeAt(0),
    );
    const descriptor: ImageDescriptor = {
      contract_version: 1,
      codec: initial.image_document.codec,
      family:
        family === 'animation'
          ? 'animation'
          : family === 'ico'
            ? 'ico'
            : family === 'svg'
              ? 'svg'
              : 'raster',
      width: canvas.width,
      height: canvas.height,
      display_width: canvas.width,
      display_height: canvas.height,
      pixels: canvas.width * canvas.height,
      decoded_bytes: canvas.width * canvas.height * 4,
      orientation: 1,
      color_policy: 'rgba8_srgb_assumed',
      profile_status: 'not_provided',
      alpha: false,
      bits_per_pixel: 32,
      capabilities: {
        view: true,
        inspect_metadata: true,
        zoom: true,
        animate: family === 'animation',
        select_frame: family === 'animation',
        select_entry: family === 'ico',
        export_entry: family === 'ico',
        edit: false,
        save: false,
      },
      limitations: [],
    };
    const family_state: ImageFamilyState =
      family === 'animation'
        ? {
            family: 'animation',
            paused: true,
            selected_frame: selection,
            frame_count: 3,
            loop_count: 0,
            frame_duration_ms: 200,
            max_composited_frames: 2,
          }
        : family === 'ico'
          ? {
              family: 'ico',
              entries: [0, 1].map((index) => ({
                index,
                width: 256,
                height: 256,
                bits_per_pixel: 32,
                encoded_bytes: bytes.length,
                preview: 'full',
                encoding: 'png',
                alpha: false,
                failure: null,
                duplicate_of: null,
              })),
              selected_entry: selection,
              selected_entry_export: true,
            }
          : family === 'svg'
            ? {
                family: 'svg',
                output: 'rasterized_png',
                external_resources: false,
                scripts: false,
                max_nodes: 50000,
                max_depth: 128,
              }
            : { family: 'raster', preview: 'full' };
    return {
      source_id: 'layout-source',
      request_id: 'layout-' + selection,
      external_revision: session.external_revision,
      preview: { kind: 'full', descriptor, png_bytes: [...bytes] },
      failure: null,
      metadata: {
        observations: [],
        statuses: [],
        unknown_fields: 0,
        profile_present: false,
      },
      family_state,
    };
  },
  exportEntry: async () => ({ status: 'cancelled', durability: null }),
};
function Harness() {
  const [session, setSession] = useState(initial);
  return (
    <>
      <AppFrameEnvironmentBridge layoutResizeCanBeIme={false} />
      <AppFrameHostBridge />
      <AppFrame host="tauri" layout="full-bleed">
        <div
          className="app-shell"
          style={{ gridTemplateRows: '48px minmax(0,1fr)' }}
        >
          <header style={{ height: 48 }}>Synthetic viewport fixture</header>
          <section
            className="document-surface"
            style={{ position: 'relative', height: '100%', padding: 0 }}
          >
            {family === 'diagram' ? (
              <DiagramViewport
                svg={svg}
                label="Large diagram"
                description="Synthetic geometry fixture"
              />
            ) : (
              <ImageSurface
                session={session}
                gateway={gateway}
                onImageChange={(_id, _revision, image) =>
                  setSession((previous) => ({
                    ...previous,
                    image_document: image,
                  }))
                }
              />
            )}
          </section>
        </div>
      </AppFrame>
    </>
  );
}
createRoot(document.getElementById('root')).render(<Harness />);
