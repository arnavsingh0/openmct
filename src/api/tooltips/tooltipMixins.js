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

const pathHoverComponents = new Set();

function dismissPathHoverTooltips() {
  pathHoverComponents.forEach((component) => {
    component.hideToolTipOnModifierRelease();
  });
}

function dismissPathHoverTooltipsForHiddenAnchors() {
  pathHoverComponents.forEach((component) => {
    component.hideToolTipIfAnchorHidden();
  });
}

function onModifierKeyUp(event) {
  if (event.key !== 'Control') {
    return;
  }

  dismissPathHoverTooltips();
}

function ensurePathHoverDismissListeners() {
  if (ensurePathHoverDismissListeners.installed === true) {
    return;
  }

  document.addEventListener('keyup', onModifierKeyUp);
  document.addEventListener('click', dismissPathHoverTooltipsForHiddenAnchors);
  window.addEventListener('blur', dismissPathHoverTooltips);
  ensurePathHoverDismissListeners.installed = true;
}

function isTooltipAnchorShown(element) {
  if (!(element instanceof Element)) {
    return false;
  }

  if (element.isConnected !== true) {
    return false;
  }

  return element.getClientRects().length > 0;
}

const tooltipHelpers = {
  mounted() {
    ensurePathHoverDismissListeners();
    pathHoverComponents.add(this);
  },
  beforeUnmount() {
    pathHoverComponents.delete(this);
    this.hideToolTip();
  },
  methods: {
    async getTelemetryPathString(telemetryIdentifier) {
      const requestId = this._beginPathHoverRequest();
      let telemetryPathString = '';

      try {
        if (!this.domainObject?.identifier) {
          return telemetryPathString;
        }

        const telemetryPath = await this.openmct.objects.getTelemetryPath(
          this.domainObject.identifier,
          telemetryIdentifier
        );

        if (telemetryPath.length) {
          telemetryPathString = telemetryPath.join(' / ');
        }
      } finally {
        this._tooltipResolvedRequestId = requestId;
      }

      return telemetryPathString;
    },
    async getObjectPath(objectIdentifier) {
      const requestId = this._beginPathHoverRequest();
      let objectPath;

      try {
        if (!objectIdentifier && !this.domainObject) {
          return objectPath;
        }

        const domainObjectIdentifier = objectIdentifier || this.domainObject.identifier;
        const objectPathList = await this.openmct.objects.getOriginalPath(domainObjectIdentifier);

        objectPathList.pop();
        objectPath = objectPathList
          .map((pathItem) => pathItem.name)
          .reverse()
          .join(' / ');
      } finally {
        this._tooltipResolvedRequestId = requestId;
      }

      return objectPath;
    },
    buildToolTip(tooltipText, tooltipLocation, elementRef, cssClasses) {
      // The path is loaded asynchronously. If the pointer left, Control was
      // released, or the anchor was hidden while that lookup was in flight,
      // showing the tooltip now would leave it stuck on document.body.
      if (!tooltipText || tooltipText.length < 1 || this._isPathHoverRequestCurrent() !== true) {
        return;
      }

      let parentElement = this.$refs[elementRef];

      if (Array.isArray(parentElement)) {
        parentElement = parentElement[0];
      }

      if (isTooltipAnchorShown(parentElement) !== true) {
        return;
      }

      this._tooltipAnchor = parentElement;
      this.tooltip = this.openmct.tooltips.tooltip({
        toolTipText: tooltipText,
        toolTipLocation: tooltipLocation,
        parentElement: parentElement,
        cssClasses
      });
    },
    hideToolTip() {
      this._invalidatePathHoverRequest();
      this._tooltipAnchor = null;

      if (this.tooltip) {
        this.tooltip.destroy();
        this.tooltip = null;
      }
    },
    hideToolTipOnModifierRelease() {
      if (this._pathHoverRequestActive !== true) {
        return;
      }

      this.hideToolTip();
    },
    hideToolTipIfAnchorHidden() {
      if (!this.tooltip) {
        return;
      }

      if (isTooltipAnchorShown(this._tooltipAnchor) === true) {
        return;
      }

      this.hideToolTip();
    },
    _beginPathHoverRequest() {
      this._pathHoverRequestActive = true;
      this._tooltipRequestId = (this._tooltipRequestId || 0) + 1;

      return this._tooltipRequestId;
    },
    _invalidatePathHoverRequest() {
      this._tooltipRequestId = (this._tooltipRequestId || 0) + 1;
    },
    _isPathHoverRequestCurrent() {
      if (this._tooltipResolvedRequestId === undefined) {
        return true;
      }

      return this._tooltipResolvedRequestId === this._tooltipRequestId;
    }
  }
};

export default tooltipHelpers;
