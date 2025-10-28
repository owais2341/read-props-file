import * as core from "@actions/core";
import { readFile } from "fs/promises";
import { glob } from "glob";
import fs from "node:fs";
import { getProperties as propertiesToObject } from "properties-file";

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
	core.debug(`Got back file ${inputs.file}`);
	const propertiesFiles = await glob(inputs.file, { ignore: ["**/node_modules/**", "**/.gradle/**"] });
	core.debug(`Got back propertiesFiles ${propertiesFiles}`);

	if (propertiesFiles.length === 0) throw new Error(`No properties files found with pattern ${inputs.file}`);

	if (propertiesFiles.length > 1)
		core.warning(`Multiple properties files found, using first one (${propertiesFiles[0]}).`);

	if (
		!propertiesFiles[0]?.toLowerCase()?.endsWith(".properties") &&
		!propertiesFiles[0]?.toLowerCase()?.endsWith(".props")
	)
		throw new Error(`File ${propertiesFiles[0]} is not a properties or props file`);

	if (!propertiesFiles[0]) throw new Error(`File ${propertiesFiles[0]} is undefined/null... This should not happen!`);
	if (!fs.existsSync(propertiesFiles[0])) throw new Error(`File ${propertiesFiles[0]} does not exist.`);

	const propertiesFile = propertiesFiles[0];
	core.debug(`🤔 Using properties file ${propertiesFile}`);
	const content = await readFile(propertiesFile, "utf8");
	const properties = propertiesToObject(content);

	// ✅ If "all" is true, export all props as GitHub outputs
	//if (inputs.all) {
	//	core.debug("🧪 Got all=true, exporting all properties as GitHub outputs");

	//	for (const [key, value] of Object.entries(properties)) {
	//		core.setOutput(key, value);
	//		core.debug(`🧪 Set output ${key}=${value}`);
	//	}
     
	//	core.info(`🚀 Successfully exported ${Object.keys(properties).length} properties as outputs`);
	//	return;
	//}

	if (inputs.all) {
         const tempFile = `/tmp/${Date.now()}_props.env`;
         let envFileContent = "";
          for (const [key, value] of Object.entries(properties)) {
           envFileContent += `${key}="${value}"\n`;
           core.setOutput(key, value);
          }
         await fs.promises.writeFile(tempFile, envFileContent);
         core.setOutput("env_path", tempFile);
         core.info(`🚀 Wrote environment file: ${tempFile}`);
         return;
        }

	// Handle single property mode
	const { property } = inputs;
	if (!property) throw new Error("Property is not defined");

	const value = properties[property];
	if (value) {
		setSingleValue(property, value);
		core.info(`🚀 Successfully set property ${property} as output`);
		return;
	}

	const defaultValue = inputs.default;
	if (defaultValue) {
		setSingleValue(property, defaultValue);
		core.info(`🚀 Successfully set property ${property} as output`);
		return;
	}

	throw new Error(`Property ${property} not found in properties file`);
};

