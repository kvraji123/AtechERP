$cpoSource = 'C:\Users\shoba\.codex\worktrees\a00b\Atech'
$cpoTarget = 'D:\Atech'
$cpoBackup = Join-Path $cpoTarget ("customer-po-backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))

$existingFiles = @(
  'backend\src\app.js',
  'backend\src\middleware\requestContext.js',
  'backend\src\middleware\errorHandler.js',
  'frontend\src\App.tsx',
  'frontend\src\layout\Sidebar.tsx'
)

foreach ($relativePath in $existingFiles) {
  $targetFile = Join-Path $cpoTarget $relativePath
  $backupFile = Join-Path $cpoBackup $relativePath

  if (Test-Path -LiteralPath $targetFile) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backupFile) | Out-Null
    Copy-Item -LiteralPath $targetFile -Destination $backupFile -Force
  }

  Copy-Item -LiteralPath (Join-Path $cpoSource $relativePath) -Destination $targetFile -Force
}

$newItems = @(
  'backend\database\customer-po-sales-order-migration.sql',
  'backend\src\modules\customer-po',
  'frontend\src\api\customerPurchaseOrder.api.ts',
  'frontend\src\pages\modules\sales'
)

foreach ($relativePath in $newItems) {
  $sourceItem = Join-Path $cpoSource $relativePath
  $targetItem = Join-Path $cpoTarget $relativePath

  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetItem) | Out-Null
  Copy-Item -LiteralPath $sourceItem -Destination $targetItem -Recurse -Force
}