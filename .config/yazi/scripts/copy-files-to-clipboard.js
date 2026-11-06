ObjC.import('AppKit');

function run(argv) {
  const pb = $.NSPasteboard.generalPasteboard;
  pb.clearContents;

  if (argv.length === 1) {
    const url = $.NSURL.fileURLWithPath(argv[0]);
    pb.writeObjects($.NSArray.arrayWithObject(url));
  } else {
    pb.declareTypesOwner(['NSFilenamesPboardType'], $());
    pb.setPropertyListForType(argv, 'NSFilenamesPboardType');
  }
}
