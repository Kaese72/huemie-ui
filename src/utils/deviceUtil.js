// src/utils/extractAttribute.js

/**
 * Extracts the value of a named attribute from a device object.
 * Returns the string, boolean, or numeric state if present, otherwise 'Unknown'.
 * @param {Object} device - The device object containing attributes.
 * @param {string} attributeName - The name of the attribute to extract.
 * @returns {string|boolean|number} The attribute value or 'Unknown'.
 */
export function extractAttribute(device, attributeName) {
  if (!device || !device.attributes) return 'Unknown';
  const attribute = device.attributes.find(attr => attr.name === attributeName);
  if (!attribute) return 'Unknown';
  if (
    attribute.hasOwnProperty('string-state') &&
    attribute['string-state'] !== undefined &&
    attribute['string-state'] !== null &&
    attribute['string-state'] !== ''
  ) {
    return attribute['string-state'];
  }
  if (
    attribute.hasOwnProperty('boolean-state') &&
    attribute['boolean-state'] !== undefined &&
    attribute['boolean-state'] !== null
  ) {
    return attribute['boolean-state'];
  }
  if (
    attribute.hasOwnProperty('numeric-state') &&
    attribute['numeric-state'] !== undefined &&
    attribute['numeric-state'] !== null
  ) {
    return attribute['numeric-state'];
  }
  return 'Unknown';
}
