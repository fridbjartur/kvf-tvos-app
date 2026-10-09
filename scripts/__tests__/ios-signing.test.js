/* global jest, beforeEach, test, expect */

jest.mock("@expo/cli/build/src/run/ios/codeSigning/configureCodeSigning", () => ({
  ensureDeviceIsCodeSignedForDeploymentAsync: jest.fn(),
}));
jest.mock("@expo/cli/build/src/run/ios/codeSigning/simulatorCodeSigning", () => ({
  simulatorBuildRequiresCodeSigning: () => false,
}));

const { ensureDeviceIsCodeSignedForDeploymentAsync: ensureSigning } = require("@expo/cli/build/src/run/ios/codeSigning/configureCodeSigning");
const { getXcodeBuildArgsAsync } = require("@expo/cli/build/src/run/ios/XcodeBuild");

const props = {
  projectRoot: "/test",
  xcodeProject: { isWorkspace: true, name: "KVF.xcworkspace" },
  configuration: "Release",
  scheme: "KVF",
  device: { udid: "test-device" },
  isSimulator: false,
  osType: "tvOS",
};

beforeEach(() => jest.clearAllMocks());

test.each([null, "TESTTEAM"])("allows device provisioning with signing result %s", async (team) => {
  ensureSigning.mockResolvedValue(team);
  const args = await getXcodeBuildArgsAsync(props);
  expect(args).toEqual(expect.arrayContaining(["-allowProvisioningUpdates", "-allowProvisioningDeviceRegistration"]));
  expect(args.filter((arg) => arg.startsWith("DEVELOPMENT_TEAM="))).toEqual(team ? [`DEVELOPMENT_TEAM=${team}`] : []);
});

test("does not provision simulator builds", async () => {
  const args = await getXcodeBuildArgsAsync({ ...props, isSimulator: true });
  expect(ensureSigning).not.toHaveBeenCalled();
  expect(args).not.toContain("-allowProvisioningUpdates");
  expect(args).not.toContain("-allowProvisioningDeviceRegistration");
});
