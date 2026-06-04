
#define ServiceName="Cachearoo"

[Setup]
AppName=Cachearoo
AppId={{53BD5F8E-0FB6-4045-AEC3-735FC793EE52}}
AppVersion={#Version}
VersionInfoVersion={#Version}
AppPublisher=Stinky Computing AB
UsePreviousAppDir=yes
DisableDirPage=yes
DefaultDirName={commonpf}\Cachearoo
DefaultGroupName=Cachearoo
LicenseFile=..\..\setup\win\license.rtf
SetupIconFile=..\..\setup\win\cachearoo.ico
Uninstallable=yes
UninstallDisplayIcon={app}\unins000.exe
ArchitecturesInstallIn64BitMode=x64
OutputBaseFilename=Cachearoo {#Version}

[Files]
Source: "..\..\build\*"; DestDir: "{app}"; Flags: replacesameversion recursesubdirs
Source: "ServiceExe.exe"; DestDir: "{app}"
Source: "Cachearoo.ini"; DestDir: "{app}"
Source: "node.exe"; DestDir: "{app}"

[Dirs]
Name: "{app}\logs"

[Registry]
Root: HKLM; Subkey: "Software\Cachearoo\"; ValueType: string; ValueName: "Version"; ValueData: {#Version}; Flags: uninsdeletekey

[Run]

[UninstallRun]
Filename: {sys}\sc.exe; Parameters: "delete {#ServiceName}"; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\*.log"

[Code]
procedure StopServices;
var
  ResultCode: Integer;
begin
  if Exec('sc.exe', ExpandConstant('stop {#ServiceName}'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    Log('Stopped Cacharoo Service');
  end else
    Log('Failed to stop Cachearoo service, code: ' + IntToStr(ResultCode));
end;


function PrepareToInstall(var NeedsRestart: Boolean): string;
begin
  StopServices();
  Result := '';
end;

function InitializeUninstall(): Boolean;
begin
  StopServices();
  Result := True;
end;


/////////////////////////////////////////////////////////////////////
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
begin
  if (CurStep = ssPostInstall) then
  begin
      Exec(ExpandConstant('{app}\ServiceExe.exe'), '-install Cachearoo.ini /A', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('sc', ExpandConstant('failure {#ServiceName} reset= 60 actions= restart/60000/restart/60000/restart/60000'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Exec('sc', ExpandConstant('start {#ServiceName}'), '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
