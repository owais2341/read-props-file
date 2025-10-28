import * as core from "@actions/core";
import { readFile } from "fs/promises";
import { glob } from "glob";
import fs from "node:fs";

type Inputs = {
	file: string;
	property?: string;
	all?: boolean;
	default?: string;
};

const setSingleValue = (key: string, value: string): void => {
	core.debug(`🧪 Setting output ${key} to ${value}`);
	core.setOutput(key, value);

	// Legacy compatibility
	core.setOutput("value", value);
	core.debug(`🧓 Setting legacy output value to ${value}`);
};

export const run = async (inputs: Inputs): Promise<void> => {
	core.debug(`📂 Searching for file pattern: ${inputs.file}`);
	const propertiesFiles = await glob(inputs.file, { ignore: ["**/node_modules/**", "**/.gradle/**"] });

	if (propertiesFiles.length === 0) throw new Error(`No properties files found with pattern ${inputs.file}`);
	if (propertiesFiles.length > 1)
		core.warning(`Multiple properties files found, using first one (${propertiesFiles[0]}).`);

	const propertiesFile = propertiesFiles[0];
	if (!propertiesFile) throw new Error("Resolved file path is null or undefined");
	if (!fs.existsSync(propertiesFile)) throw new Error(`File ${propertiesFile} does not exist`);

	if (
		!propertiesFile.toLowerCase().endsWith(".properties") &&
		!propertiesFile.toLowerCase().endsWith(".props")
	)
		throw new Error(`File ${propertiesFile} is not a valid .properties or .props file`);

	core.debug(`✅ Using properties file: ${propertiesFile}`);

	// --- Parse manually using default JS ---
	const content = await readFile(propertiesFile, "utf8");
	const props: Record<string, string> = {};

	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const eqIndex = trimmed.indexOf("=");
		if (eqIndex === -1) continue;

		const key = trimmed.substring(0, eqIndex).trim();
		const value = trimmed.substring(eqIndex + 1).trim();

		props[key] = value;
	}

	// --- ALL MODE ---
	if (inputs.all) {
		core.debug("🧪 Got all=true → exporting all properties as outputs, JSON, and bash array");

		for (const [key, value] of Object.entries(props)) {
			core.setOutput(key, value);
			core.debug(`🧪 Set output ${key}=${value}`);
		}

		// JSON Output
		const jsonOutput = JSON.stringify(props, null, 2);
		core.setOutput("props", jsonOutput);

		// Bash associative array
		let bashArray = 'declare -A esbProps=(';
		for (const [key, value] of Object.entries(props)) {
			const safeKey = key.replace(/"/g, '\\"');
			const safeValue = value.replace(/"/g, '\\"');
			bashArray += `["${safeKey}"]="${safeValue}" `;
		}
		bashArray += ")";
		core.setOutput("bash_array", bashArray);

		core.info(`🚀 Exported ${Object.keys(props).length} properties successfully`);
		return;
	}

	// --- SINGLE PROPERTY MODE ---
	const { property } = inputs;
	if (!property) throw new Error("Property is not defined and 'all' is not true");

	const value = props[property];
	if (value) {
		setSingleValue(property, value);
		core.info(`🚀 Successfully set property ${property} as output`);
		return;
	}

	const defaultValue = inputs.default;
	if (defaultValue) {
		setSingleValue(property, defaultValue);
		core.info(`🚀 Used default value for ${property}`);
		return;
	}

	throw new Error(`Property ${property} not found in ${propertiesFile}`);
};

