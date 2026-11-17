/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2024, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/
import mount from 'utils/mount';
import { createOpenMct, resetApplicationState } from 'utils/testing';

import tooltipHelpers from './tooltipMixins.js';

const CLOCK_IDENTIFIER = {
  namespace: 'test',
  key: 'clock-a'
};

function originalPath(...names) {
  return names.map((name) => {
    return { name };
  });
}

describe('path hover tooltips', () => {
  let openmct;
  let parent;
  let destroyHost;
  let hostDestroyed;
  let host;
  let pendingPaths;

  beforeEach(() => {
    openmct = createOpenMct();
    pendingPaths = [];
    spyOn(openmct.objects, 'getOriginalPath').and.callFake(() => {
      return new Promise((resolve) => {
        pendingPaths.push(resolve);
      });
    });

    parent = document.createElement('div');
    document.body.appendChild(parent);

    const mounted = mount(
      {
        components: {
          PathHoverHost: {
            mixins: [tooltipHelpers],
            inject: ['openmct'],
            template: '<div ref="objectLabel" class="path-hover-anchor">Clock A</div>',
            methods: {
              async showPathTooltip() {
                const { BELOW } = this.openmct.tooltips.TOOLTIP_LOCATIONS;

                this.buildToolTip(await this.getObjectPath(CLOCK_IDENTIFIER), BELOW, 'objectLabel');
              }
            }
          }
        },
        provide: {
          openmct
        },
        template: '<path-hover-host ref="host"></path-hover-host>'
      },
      {
        element: parent
      }
    );

    destroyHost = mounted.destroy;
    hostDestroyed = false;
    host = mounted.vNode.componentInstance.$refs.host;
  });

  function destroyMountedHost() {
    if (hostDestroyed === true) {
      return;
    }

    hostDestroyed = true;
    destroyHost();
  }

  afterEach(() => {
    if (parent.isConnected === true) {
      destroyMountedHost();
      parent.remove();
    }

    document.querySelectorAll('.c-tooltip-wrapper').forEach((tooltip) => {
      tooltip.remove();
    });

    return resetApplicationState(openmct);
  });

  it('shows the path when the lookup finishes while the anchor is visible', async () => {
    const showTooltip = host.showPathTooltip();

    pendingPaths[0](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await showTooltip;

    expect(document.querySelector('[role="tooltip"]').textContent).toContain(
      'My Items / Red Folder / Clock A'
    );
  });

  it('does not show a path tooltip if the pointer leaves before the path resolves', async () => {
    const showTooltip = host.showPathTooltip();

    host.hideToolTip();
    pendingPaths[0](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await showTooltip;

    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('ignores an older lookup that resolves after a newer hover', async () => {
    const firstHover = host.showPathTooltip();
    const secondHover = host.showPathTooltip();

    pendingPaths[1](originalPath('Clock B', 'Blue Folder', 'My Items', 'Open MCT'));
    await secondHover;

    expect(document.querySelector('[role="tooltip"]').textContent).toContain('Blue Folder');

    pendingPaths[0](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await firstHover;

    expect(document.querySelector('[role="tooltip"]').textContent).toContain('Blue Folder');
    expect(document.querySelector('[role="tooltip"]').textContent).not.toContain('Red Folder');
  });

  it('removes the path tooltip when Control is released and drops a lookup still in flight', async () => {
    const firstHover = host.showPathTooltip();

    pendingPaths[0](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await firstHover;
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();

    const secondHover = host.showPathTooltip();

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();

    pendingPaths[1](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await secondHover;

    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('removes a visible path tooltip when its anchor is hidden', async () => {
    const showTooltip = host.showPathTooltip();

    pendingPaths[0](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await showTooltip;

    host.$refs.objectLabel.style.display = 'none';
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('removes the path tooltip when the anchor component is destroyed', async () => {
    const showTooltip = host.showPathTooltip();

    pendingPaths[0](originalPath('Clock A', 'Red Folder', 'My Items', 'Open MCT'));
    await showTooltip;
    destroyMountedHost();

    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('still shows tooltips that are not opened with Control', () => {
    const { RIGHT } = openmct.tooltips.TOOLTIP_LOCATIONS;

    host.buildToolTip('Limit exceeded', RIGHT, 'objectLabel');
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }));

    expect(document.querySelector('[role="tooltip"]').textContent).toContain('Limit exceeded');

    host.hideToolTip();
    host.buildToolTip('Limit exceeded', RIGHT, 'objectLabel');

    expect(document.querySelector('[role="tooltip"]').textContent).toContain('Limit exceeded');
  });
});
