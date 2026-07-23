function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Video to MP3 Converter')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
