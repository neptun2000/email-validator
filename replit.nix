{pkgs}: {
  deps = [
    pkgs.rustc
    pkgs.libiconv
    pkgs.cargo
    pkgs.libxcrypt
    pkgs.openssl
    pkgs.bind
    pkgs.cacert
  ];
}
