import assert from "assert";

import { Assert } from "../../main.test";

export const steps = [];

export const assert_preview: Assert = (_, blocks) => assert.rejects(blocks);