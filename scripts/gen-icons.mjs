/**
 * PWA icon generator.
 *
 * Icons are now generated from the LOCAL photo: public/me.png
 * (resized with PowerShell System.Drawing on Windows — see README history).
 *
 * Running `npm run icons` no longer fetches the GitHub avatar; it verifies
 * the local icons exist and are up-to-date with me.png. To regenerate from
 * a new photo, replace public/me.png and delete the icon-*.png files first.
 */
import { stat, unlink } from "node:fs/promises";

const me = await stat("./public/me.png").catch(() => null);
if (!me) {
  console.error("✗ public/me.png not found — add your photo first.");
  process.exit(1);
}

for (const name of ["icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  const s = await stat(`./public/${name}`).catch(() => null);
  if (!s || s.mtimeMs < me.mtimeMs) {
    console.log(`↻ ${name} is older than me.png — regenerating…`);
    // Delegate to the PowerShell resizer (Windows) for a dependency-free resize.
    const { execSync } = await import("node:child_process");
    execSync(
      `powershell.exe -NoProfile -Command "Add-Type -AssemblyName System.Drawing; ` +
        `$src=[System.Drawing.Image]::FromFile((Resolve-Path 'public/me.png')); ` +
        `foreach($size in 192,512){ $bmp=New-Object System.Drawing.Bitmap($size,$size); ` +
        `$g=[System.Drawing.Graphics]::FromImage($bmp); ` +
        `$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; ` +
        `$g.DrawImage($src,0,0,$size,$size); ` +
        `$bmp.Save((Join-Path (Get-Location) 'public/icon-'+$size+'.png'),[System.Drawing.Imaging.ImageFormat]::Png); ` +
        `$g.Dispose(); $bmp.Dispose() }; $src.Dispose()"`,
      { stdio: "inherit" }
    );
    await unlink("./public/icon-maskable-512.png").catch(() => {});
    const { copyFile } = await import("node:fs/promises");
    await copyFile("./public/icon-512.png", "./public/icon-maskable-512.png");
    console.log("✓ icons regenerated from me.png");
    process.exit(0);
  }
}
console.log("✓ icons already up-to-date with public/me.png — nothing to do.");
