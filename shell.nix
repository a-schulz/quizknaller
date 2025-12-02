{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.uv
  ];

  shellHook = ''
    echo "uv is now available"
  '';
}
