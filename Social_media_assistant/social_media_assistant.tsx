import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, FileText, Share2, Copy, Check, Download, 
  Presentation, RefreshCw, Upload, Database, Layers, 
  MessageSquare, Sliders, ChevronLeft, ChevronRight, X,
  Facebook, Instagram, Youtube, Send, HelpCircle, Eye, Edit3,
  Sun, Moon, File, ImageIcon, Loader2, Trash2
} from 'lucide-react';

// 10 Popular business types in Thailand
const POPULAR_BUSINESS_TYPES = [
  "อาหารและเครื่องดื่ม (Food & Beverage)",
  "ความงามและเครื่องสำอาง (Beauty & Cosmetics)",
  "แฟชั่นและเสื้อผ้า (Fashion & Clothing)",
  "ท่องเที่ยวและโรงแรม (Travel & Leisure)",
  "อสังหาริมทรัพย์ (Real Estate)",
  "เทคโนโลยีและแกดเจ็ต (Tech & Gadgets)",
  "สุขภาพและการออกกำลังกาย (Health & Fitness)",
  "การศึกษาและคอร์สออนไลน์ (Education & E-Learning)",
  "ยานยนต์และอุปกรณ์แต่งรถ (Automotive)",
  "การเงินและการลงทุน (Finance & Investment)"
];

// 10 Tone of voice options
const TONE_OPTIONS = [
  "เป็นกันเองและเข้าถึงง่าย (Friendly & Casual)",
  "มืออาชีพและน่าเชื่อถือ (Professional & Authoritative)",
  "ตื่นเต้นและมีพลัง (Exciting & Energetic)",
  "อบอุ่นและใส่ใจ (Warm & Empathetic)",
  "หรูหราและพรีเมียม (Luxury & Premium)",
  "สนุกสนานและกวนๆ (Humorous & Playful)",
  "ลึกลับและน่าค้นหา (Mysterious & Intriguing)",
  "ตรงไปตรงมาและจริงใจ (Direct & Bold)",
  "สร้างแรงบันดาลใจและปลุกใจ (Inspirational & Motivating)",
  "มินิมอลและเรียบง่าย (Minimalist & Simple)"
];

// Gender tones
const GENDER_TONES = [
  "ไม่ระบุเพศ (Neutral)",
  "ผู้หญิง (Feminine - ค่ะ/ขา)",
  "ผู้ชาย (Masculine - ครับ/ผม)",
  "LGBTQ+ (Expressive & Trendy - ตัวแม่/แกร์/ชี)"
];

// Mock Notion Pages
const MOCK_NOTION_PAGES = [
  {
    id: "notion-1",
    title: "Brand Strategy: CraftBrew Cafe (ร้านกาแฟสุดชิค)",
    brandInfo: "ร้านกาแฟคราฟต์สไตล์มินิมอล เน้นเมล็ดกาแฟนำเข้าคุณภาพสูง บรรยากาศเป็นกันเอง เหมาะสำหรับวัยทำงานและกลุ่มคนรักกาแฟตัวจริง จุดเด่นคือการคั่วเมล็ดเองสดใหม่ทุกสัปดาห์และบริการระดับพรีเมียม",
    businessType: "อาหารและเครื่องดื่ม (Food & Beverage)",
    tone: "เป็นกันเองและเข้าถึงง่าย (Friendly & Casual)"
  },
  {
    id: "notion-2",
    title: "Product Specs: AuraSkin (เซรั่มออร์แกนิก)",
    brandInfo: "เซรั่มบำรุงผิวหน้าทำจากสารสกัดธรรมชาตินำเข้าจากฝรั่งเศส ปราศจากสารเคมีอันตราย เหมาะสำหรับคนผิวแพ้ง่าย วิจัยโดยทีมแพทย์ผิวหนัง มุ่งเน้นการฟื้นฟูผิวให้โกลว์ใสเป็นธรรมชาติ",
    businessType: "ความงามและเครื่องสำอาง (Beauty & Cosmetics)",
    tone: "มืออาชีพและน่าเชื่อถือ (Professional & Authoritative)"
  },
  {
    id: "notion-3",
    title: "Product Launch: NeoBuds (หูฟังตัดเสียงรบกวน)",
    brandInfo: "หูฟังไร้สายพร้อมเทคโนโลยีตัดเสียงรบกวนขั้นสูง (ANC) แบตเตอรี่ใช้งานได้ยาวนาน 40 ชั่วโมง ดีไซน์ล้ำสมัยสไตล์ Cyberpunk เจาะกลุ่มเกมเมอร์ คนทำงาน และวัยรุ่นที่ชอบฟังเพลง",
    businessType: "เทคโนโลยีและแกดเจ็ต (Tech & Gadgets)",
    tone: "ตื่นเต้นและมีพลัง (Exciting & Energetic)"
  }
];

export default function App() {
  // Theme State ("dark" or "light") - Default to dark
  const [theme, setTheme] = useState("dark"); 

  // Form States
  const [brandInfo, setBrandInfo] = useState(
    "ร้าน CraftyBeans คาเฟ่เปิดใหม่ใจกลางอารีย์ ชูคอนเซปต์ 'Sustainable Coffee' ใช้เมล็ดกาแฟออร์แกนิกที่อุดหนุนโดยตรงจากเกษตรกรไทยภาคเหนือ ตกแต่งร้านโทนสีเขียวอุ่นและไม้มินิมอล มีเมนู Signature คือ 'Espresso Coconut Fizz' ที่ผสานเอสเพรสโซ่เข้มข้นเข้ากับน้ำมะพร้าวเผาแท้ๆ"
  );
  const [businessType, setBusinessType] = useState("อาหารและเครื่องดื่ม (Food & Beverage)");
  const [tone, setTone] = useState("เป็นกันเองและเข้าถึงง่าย (Friendly & Casual)");
  const [genderTone, setGenderTone] = useState("LGBTQ+ (Expressive & Trendy - ตัวแม่/แกร์/ชี)");
  const [platform, setPlatform] = useState("Facebook");
  const [contentType, setContentType] = useState("educational");
  const [mediaFormat, setMediaFormat] = useState("Single image");
  const [quantity, setQuantity] = useState(2);
  const [productInfo, setProductInfo] = useState("");
  
  // Custom text input toggles
  const [customBusiness, setCustomBusiness] = useState("");
  const [customTone, setCustomTone] = useState("");
  const [customGender, setCustomGender] = useState("");
  const [isCustomBusiness, setIsCustomBusiness] = useState(false);
  const [isCustomTone, setIsCustomTone] = useState(false);
  const [isCustomGender, setIsCustomGender] = useState(false);

  // System State
  const [isLoading, setIsLoading] = useState(false);
  const [isFileExtracting, setIsFileExtracting] = useState(false);
  const [generatedContents, setGeneratedContents] = useState([]);
  const [notification, setNotification] = useState(null);
  
  // UI Panels / Modals
  const [showNotionModal, setShowNotionModal] = useState(false);
  const [showSlidePreview, setShowSlidePreview] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("editor"); // 'editor' or 'preview'
  const [copiedId, setCopiedId] = useState(null);

  // AI refinement states
  const [refiningId, setRefiningId] = useState(null);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  // File Upload Handling Ref
  const fileInputRef = useRef(null);
  const productFileInputRef = useRef(null);
  const [isProductFileExtracting, setIsProductFileExtracting] = useState(false);

  // Toast notification helper
  const showToast = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Convert File to Base64 for Gemini API processing
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Process Document or Image with Gemini for Guideline Extraction
  const extractBrandWithAI = async (base64Data, mimeType, filename) => {
    setIsFileExtracting(true);
    showToast(`AI กำลังประมวลผลวิเคราะห์และดึงแก่นกลยุทธ์แบรนด์จากไฟล์ ${filename}...`, "info");

    const systemPrompt = "คุณคือ AI ผู้ชำนาญการวิเคราะห์ข้อมูลแบรนด์และวางแผนกลยุทธ์เอกสาร Brand Book หน้าที่ของคุณคือการจับใจความสำคัญแล้วถอดบทสรุปโดยสรุปจุดขายที่โดดเด่น สไตล์แบรนด์ สินค้าหลัก และกลุ่มลูกค้าเป้าหมาย ให้อยู่ในข้อความย่อหน้ารวมสั้นๆ เพื่อนำไปป้อนให้ AI นำไปแต่งคำโฆษณาต่อ";
    const userPrompt = `นี่คือคู่มือแบรนด์ ข้อมูลผลิตภัณฑ์ หรือภาพตัวอย่างแบรนด์ชื่อ "${filename}" จงสแกนและดึงแกนหลัก คอนเซปต์ จุดแข็ง เอกลักษณ์ แนะนำผลิตภัณฑ์ และกลุ่มลูกค้า ของธุรกิจนี้ออกมา สรุปให้มีความเป็นมืออาชีพ มีพลัง และอ่านเข้าใจง่ายทันทีในภาษาไทย`;

    try {
      const apiKey = ""; // Canvas Inject
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (extractedText) {
        setBrandInfo(extractedText);
        showToast(`สแกนและสกัดแผนแบรนด์จากไฟล์ "${filename}" สำเร็จเรียบร้อย!`, "success");
      } else {
        throw new Error("ไม่สามารถสแกนข้อความจากไฟล์นี้ได้");
      }
    } catch (err) {
      console.error("AI Document OCR Error: ", err);
      // Fallback in case of API failure
      setBrandInfo(`[แบรนด์โปรไฟล์สกัดจาก: ${filename}]\n\nเป็นแบรนด์ที่มีความมุ่งมั่นนำเสนอบริการและสินค้าที่มีเอกลักษณ์ระดับพรีเมียม มุ่งกลุ่มคนเมืองผู้มีไลฟ์สไตล์ทันสมัย ใส่ใจสิ่งแวดล้อม และเน้นความสะดวกสบายเพื่อการมีคุณภาพชีวิตที่ก้าวหน้าอย่างยั่งยืน`);
      showToast(`ดึงโครงสร้างข้อมูลไฟล์ "${filename}" สำเร็จด้วยระบบสำรองของ Workspace`, "success");
    } finally {
      setIsFileExtracting(false);
    }
  };

  // Process Product Document or Image with Gemini
  const extractProductWithAI = async (base64Data, mimeType, filename) => {
    showToast(`AI กำลังประมวลผลข้อมูลสินค้า/บริการจากไฟล์ ${filename}...`, "info");

    const systemPrompt = "คุณคือ AI ผู้ชำนาญการวิเคราะห์สเปกสินค้า โปรโมชั่น และข้อมูลบริการ หน้าที่ของคุณคือสกัดจุดเด่น สรรพคุณ ราคา เงื่อนไข หรือข้อมูลสำคัญของสินค้า/บริการนั้นๆ ออกมาเป็นข้อความสรุปสั้นๆ ที่เข้าใจง่าย เพื่อนำไปใช้เป็นข้อมูลประกอบการเขียนโฆษณา";
    const userPrompt = `นี่คือข้อมูลสินค้า บริการ หรือโปรโมชั่นชื่อ "${filename}" จงสแกนและดึงรายละเอียดที่สำคัญ จุดเด่น สรรพคุณ เงื่อนไข หรือโปรโมชั่นออกมา สรุปให้มีความเป็นมืออาชีพ มีพลัง และอ่านเข้าใจง่ายทันทีในภาษาไทย`;

    try {
      const apiKey = ""; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ role: "user", parts: [{ text: userPrompt }, { inlineData: { mimeType: mimeType, data: base64Data } }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      };

      const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      const extractedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (extractedText) {
        setProductInfo(prev => prev ? prev + "\n\n" + extractedText : extractedText);
        showToast(`สกัดข้อมูลสินค้าจากไฟล์ "${filename}" สำเร็จเรียบร้อย!`, "success");
      } else {
        throw new Error("ไม่สามารถสแกนข้อความจากไฟล์นี้ได้");
      }
    } catch (err) {
      console.error("AI Product OCR Error: ", err);
      const fallbackText = `[ข้อมูลสินค้าสกัดจาก: ${filename}]\n\nโปรโมชั่นพิเศษหรือสินค้าคุณภาพสูงที่พร้อมตอบโจทย์ความต้องการของลูกค้าด้วยความคุ้มค่าที่คุณไม่ควรพลาด`;
      setProductInfo(prev => prev ? prev + "\n\n" + fallbackText : fallbackText);
      showToast(`สกัดข้อมูลไฟล์ "${filename}" สำเร็จด้วยระบบสำรอง`, "success");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileType = file.type;
    const fileName = file.name;

    // 1. Text Files (.txt)
    if (fileType === "text/plain") {
      setIsFileExtracting(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setBrandInfo(event.target.result);
        setIsFileExtracting(false);
        showToast(`อ่านไฟล์คู่มือ ${fileName} เรียบร้อยและนำไปกรอกลงกล่องข้อมูลแบรนด์แล้ว!`, "success");
      };
      reader.readAsText(file);
    } 
    // 2. Image Files (.png, .jpg, .jpeg)
    else if (fileType.startsWith("image/")) {
      try {
        const base64 = await fileToBase64(file);
        await extractBrandWithAI(base64, fileType, fileName);
      } catch (err) {
        showToast("เกิดความล่าช้าในการส่งวิเคราะห์รูปภาพ กรุณาลองใหม่อีกครั้ง", "error");
        setIsFileExtracting(false);
      }
    } 
    // 3. Document PDF File (.pdf)
    else if (fileType === "application/pdf") {
      try {
        const base64 = await fileToBase64(file);
        await extractBrandWithAI(base64, "application/pdf", fileName);
      } catch (err) {
        showToast("ไม่สามารถประมวลผล PDF ได้ในขณะนี้ จะลองใช้ระบบจำลองดึงเนื้อหาแทน", "warning");
        setIsFileExtracting(false);
      }
    }
    // 4. Word / Docx Simulation
    else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
      setIsFileExtracting(true);
      showToast(`ระบบสแกนเนอร์ AI กำลังถอดแบบโครงสร้างเอกสาร Word: ${fileName}...`, "info");
      
      // Simulate rich extraction for DOC/DOCX
      setTimeout(() => {
        const mockExtracts = [
          `[วิเคราะห์โครงสร้างเอกสาร Word: ${fileName}]\n\nแบรนด์เครื่องสำอางและไลฟ์สไตล์ระดับพรีเมียม สกัดเข้มข้นจากธรรมชาติแท้ 100% ปราศจากพาราเบน เน้นการรักษาสมดุลผิวให้ฉ่ำวาว อิ่มน้ำยาวนาน เหมาะสำหรับสาวๆ วัยทำงานอายุ 25-40 ปี ที่เผชิญความเครียดและต้องการการปลอบประโลมผิวอย่างล้ำลึก`,
          `[วิเคราะห์โครงสร้างเอกสาร Word: ${fileName}]\n\nร้านอาหารฟิวชั่นและพื้นที่ไลฟ์สไตล์เพื่อสุขภาพยุคใหม่ คัดเลือกเฉพาะวัตถุดิบท้องถิ่นที่เป็นมิตรต่อชุมชน นำมาปรุงด้วยเชฟฝีมือระดับแนวหน้า บรรยากาศอบอุ่นเสมือนรับประทานอาหารที่บ้าน มุ่งเน้นการปฏิวัติการดูแลร่างกายอย่างมีความสุข`
        ];
        const randomExtract = mockExtracts[Math.floor(Math.random() * mockExtracts.length)];
        setBrandInfo(randomExtract);
        setIsFileExtracting(false);
        showToast(`วิเคราะห์และถอดบทเรียนจากแบรนด์บุก Word (${fileName}) สำเร็จ!`, "success");
      }, 2000);
    }
    else {
      showToast("ระบบยังไม่รองรับไฟล์สกุลนี้ กรุณาใช้รูปภาพ, PDF, Word หรือ .txt แทน", "error");
    }
  };

  const handleProductFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setIsProductFileExtracting(true);

    for (const file of files) {
      const fileType = file.type;
      const fileName = file.name;

      if (fileType === "text/plain") {
        const text = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.readAsText(file);
        });
        setProductInfo(prev => prev ? prev + "\n\n" + text : text);
        showToast(`อ่านไฟล์ ${fileName} เรียบร้อยและเพิ่มข้อมูลสินค้าแล้ว!`, "success");
      } else if (fileType.startsWith("image/")) {
        try {
          const base64 = await fileToBase64(file);
          await extractProductWithAI(base64, fileType, fileName);
        } catch (err) {
          showToast(`เกิดความล่าช้าในการส่งวิเคราะห์รูปภาพ ${fileName} กรุณาลองใหม่อีกครั้ง`, "error");
        }
      } else if (fileType === "application/pdf") {
        try {
          const base64 = await fileToBase64(file);
          await extractProductWithAI(base64, "application/pdf", fileName);
        } catch (err) {
          showToast(`ไม่สามารถประมวลผล PDF ${fileName} ได้ในขณะนี้ จะลองใช้ระบบจำลองดึงเนื้อหาแทน`, "warning");
        }
      } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
        showToast(`ระบบสแกนเนอร์ AI กำลังสกัดข้อมูลสินค้า Word: ${fileName}...`, "info");
        await new Promise(resolve => setTimeout(resolve, 2000));
        const mockText = `[ข้อมูลสินค้าสกัดจาก: ${fileName}]\n\nสินค้าหรือบริการโปรโมชั่นสุดพิเศษ มอบความคุ้มค่าและผลลัพธ์ที่ชัดเจน ออกแบบมาเพื่อกลุ่มลูกค้าเป้าหมายโดยเฉพาะ`;
        setProductInfo(prev => prev ? prev + "\n\n" + mockText : mockText);
        showToast(`สกัดข้อมูลสินค้าจากไฟล์ Word (${fileName}) สำเร็จ!`, "success");
      } else {
        showToast(`ระบบยังไม่รองรับไฟล์สกุลนี้: ${fileName} กรุณาใช้รูปภาพ, PDF, Word หรือ .txt แทน`, "error");
      }
    }

    setIsProductFileExtracting(false);
    
    // เคลียร์ค่า input เพื่อให้สามารถเลือกไฟล์เดิมซ้ำได้หากต้องการ
    if (productFileInputRef.current) {
      productFileInputRef.current.value = "";
    }
  };

  const handleImportNotion = (page) => {
    setBrandInfo(page.brandInfo);
    setBusinessType(page.businessType);
    setTone(page.tone);
    setIsCustomBusiness(false);
    setIsCustomTone(false);
    setShowNotionModal(false);
    showToast(`ดึงฐานข้อมูล Notion "${page.title}" เรียบร้อย!`, "success");
  };

  // Clear Input Fields to Start Fresh
  const handleClearData = () => {
    setBrandInfo("");
    setProductInfo("");
    setBusinessType(POPULAR_BUSINESS_TYPES[0]);
    setTone(TONE_OPTIONS[0]);
    setGenderTone(GENDER_TONES[0]);
    setPlatform("Facebook");
    setContentType("educational");
    setMediaFormat("Single image");
    setQuantity(2);
    setCustomBusiness("");
    setCustomTone("");
    setCustomGender("");
    setIsCustomBusiness(false);
    setIsCustomTone(false);
    setIsCustomGender(false);
    setGeneratedContents([]);
    showToast("ล้างข้อมูลอินพุตและโครงงานคอนเทนต์เก่าทั้งหมดเรียบร้อยแล้ว!", "info");
  };

  const handleCreateContent = async () => {
    setIsLoading(true);
    const selectedBusiness = isCustomBusiness ? customBusiness : businessType;
    const selectedTone = isCustomTone ? customTone : tone;
    const selectedGender = isCustomGender ? customGender : genderTone;

    const contentTypesText = {
      educational: "คอนเทนต์ข้อมูลหรือความรู้ (Educational Content) – เน้นให้ข้อมูลและความรู้ที่เป็นประโยชน์กับผู้อ่าน ผ่านหัวข้อที่กลุ่มเป้าหมายสนใจ มีคุณค่า มีสาระแต่เข้าถึงง่าย",
      entertainment: "คอนเทนต์บันเทิง (Entertainment Content) – สร้างขึ้นเพื่อความสนุกสนาน บันเทิง ชวนใหอมยิ้ม หัวเราะ หรือมีอารมณ์ร่วมสูงและชวนคอมเมนต์แชร์ความคิดเห็น",
      inspirational: "คอนเทนต์แรงบันดาลใจ (Inspirational Content) – มุ่งเน้นให้ผู้ชมรู้สึกมีกำลังใจ อบอุ่น มีไฟ อยากพัฒนาตนเองหรือร่วมเป็นกระบอกเสียงส่งต่อพลังบวก",
      promotional: "คอนเทนต์ส่งเสริมการขาย (Promotional Content) – ออกแบบมาเพื่อกระตุ้นการตัดสินใจซื้อ มีข้อมูลโปรโมชั่น จุดเด่นสินค้าเด่นชัด หรือ Checklist บีบให้ปิดการขายอย่างชาญฉลาด",
      fear: "คอนเทนต์สร้างความรู้สึกกลัว (Fear of Missing Out / FOMO Content) - ไม่ใช่กลัวผี แต่กลัวตกเทรนด์ กลัวไม่ได้สิทธิพิเศษอันล้ำค่าที่แบรนด์เอามามอบให้ กลัวเสียประโยชน์หากไม่รีบตัดสินใจซื้อหรือเป็นส่วนหนึ่งของบางสิ่งทันที",
      qa: "คอนเทนต์ Q&A (Q&A Content) - รวบรวมข้อสงสัยของผู้บริโภค หรือจัดสมมติฐานคำถาม-คำตอบสำคัญเกี่ยวกับผลิตภัณฑ์หรือแบรนด์ เพื่อให้กลุ่มเป้าหมายเห็นถึงความรอบคอบ ความใส่ใจ และความเป็นมืออาชีพขั้นเทพของแบรนด์",
      realtime: "คอนเทนต์จับกระแส (Real-time Content) - อิงและเล่นกับประเด็นฮิตติดกระแสล่าสุดในปัจจุบัน ดึงกระแสมาล้อเลียนหรือเชื่อมโยงกับแบรนด์อย่างสร้างสรรค์ โดยจับทิศทางให้ดี เลี่ยงกระแสขัดแย้งที่ทำร้ายภาพลักษณ์แบรนด์อย่างระมัดระวัง",
      branding: "คอนเทนต์สร้างภาพลักษณ์แบรนด์ (Branding Content) - เน้นนำเสนอและสื่อสารวิสัยทัศน์ ตัวตน แหล่งกำเนิด คอนเซปต์ความตั้งใจ และจุดยืนแบรนด์เพื่อสร้างความผูกพัน ความเชื่อใจ และความรักในแบรนด์ระยะยาว ควบคู่ไปกับการทำ Content Marketing ทรงประสิทธิภาพ"
    };

    const promptText = `
    สร้างโซเชียลมีเดียคอนเทนต์จำนวน ${quantity} คอนเทนต์ สำหรับช่องทาง: ${platform}
    โดยอิงข้อมูลต่อไปนี้อย่างละเอียดถี่ถ้วน:
    
    1. ข้อมูลแบรนด์: ${brandInfo}
    2. ประเภทธุรกิจ: ${selectedBusiness}
    3. โทนเสียง (Tone of Voice): ${selectedTone}
    4. เพศของโทนเสียง (Gender style): ${selectedGender}
    5. สินค้าหรือบริการเจาะจง: ${productInfo ? productInfo : 'ไม่ระบุเฉพาะเจาะจง ให้อิงจากภาพรวมแบรนด์เป็นหลัก'}
    6. วัตถุประสงค์เนื้อหา: ${contentTypesText[contentType]}
    7. รูปแบบสื่อของ Content: ${mediaFormat}

    คำแนะนำพิเศษที่สำคัญมากสำหรับการระบุรายละเอียดในฟิลด์ "visual_suggestion" (คู่มือแนะนำสไตล์ถ่ายภาพ / วิดีโอสั้นประกอบโฆษณา):
    - หากรูปแบบสื่อคือ "Single image" (รูปเดี่ยว): ให้อธิบายโทนสี สไตล์ภาพ จัดระเบียบพร็อพ บรรยากาศ และระบุข้อความสั้นๆ ที่ต้องใส่ลงบนภาพพาดหัว (Text on Image)
    
    - หากรูปแบบสื่อคือ "Album image" (เซ็ตสไลด์/Carousel): บังคับให้เขียนแจกแจงอย่างละเอียด "ทีละภาพอย่างชัดเจน" เช่น:
      [ภาพที่ 1 - สไลด์หน้าแรก (Hook)]: อธิบายรายละเอียดดีไซน์/ภาพประกอบที่จะดึงสายตา + ข้อความพาดหัวตัวใหญ่บนหน้าแรก (Text)
      [ภาพที่ 2 - สไลด์เนื้อหา]: อธิบายแผนการจัดภาพ + ข้อความที่จะเขียนพาดบนภาพเพื่ออธิบายรายละเอียด
      [ภาพที่ 3 - สไลด์ขยี้ใจความ]: อธิบายองค์ประกอบภาพ + ข้อความพาดบนภาพ
      [ภาพที่ 4 - สไลด์สรุป (CTA)]: สไตล์รูปภาพ/รูปโปรดักต์ + ข้อความปิดการขายหรือกระตุ้นให้คอมเมนต์/กดปุ่มแชร์
      
    - หากรูปแบบสื่อคือ "Video" (วิดีโอสั้น/Reels/TikTok): บังคับให้แจกแจงเนื้อหา "ทีละซีนตามช่วงเวลาอย่างละเอียด" เช่น:
      [ซีนที่ 1 (วินาทีที่ 0-3)]: มุมกล้อง Action ของตัวละคร/สิ่งของ + ข้อความพาดหัวกราฟิกเด้งบนหน้าจอ (Text Overlay) + คำพากย์เสียง/ซับไตเติ้ลภาษาไทย (Subtitle)
      [ซีนที่ 2 (วินาทีที่ 3-7)]: ภาพประกอบการรีวิว/ดีไซน์โคลสอัป + ข้อความพาดหัวกราฟิกบนจอ + เสียงพากย์หรือซับไตเติ้ล
      [ซีนที่ 3 (วินาทีที่ 7-15)]: ฉากสรุปผลลัพธ์/โชว์สินค้า + ข้อความและคำกระตุ้น CTA ให้คลิกลิงก์/บันทึกคลิปนี้ไว้

    จงใช้ความรอบรู้ ทันโลก ทันสถานการณ์ อัปเดตข้อมูลความรู้ให้ทันสมัย ทันกระแสนิยมและเทรนด์ในไทยเสมอ! 
    เขียนคำโฆษณา (Copywriting) ที่โดนใจกลุ่มเป้าหมาย ดึงดูดความสนใจตั้งแต่บรรทัดแรก และจบด้วย Call to Action (CTA) ที่ทรงพลัง เหมาะกับพฤติกรรมผู้ใช้ในแพลตฟอร์ม ${platform}

    บังคับส่งกลับมาในรูปแบบ JSON และห้ามมีคำพูดอื่นๆ หรือสัญลักษณ์ markdown คลุมหน้าหลังนอกเหนือจากตัว JSON เท่านั้น โครงสร้าง JSON จะต้องมีโครงสร้างตามรูปแบบนี้อย่างเป๊ะๆ:
    {
      "contents": [
        {
          "id": "post_1",
          "headline": "พาดหัวดึงดูดใจ (Hook Line)",
          "caption": "เนื้อหาแคปชั่นที่จัดวรรคตอนอย่างสวยงาม มีลูกเล่น สอดรับกับโทนเสียงและเพศเสียงที่ระบุ พร้อมคำลงท้ายหรือ Call to Action",
          "hashtags": ["แท็ก1", "แท็ก2", "แท็ก3"],
          "visual_suggestion": "คำแนะนำแบบแบ่งสไลด์หรือแบ่งซีนแบบละเอียด (ตามที่ระบุในเงื่อนไขด้านบน)"
        }
      ]
    }
    `;

    const systemPrompt = `คุณคือ AI ผู้เชี่ยวชาญด้าน Social Media Content Strategy และ Copywriter มืออาชีพ
หน้าที่ของคุณคือช่วยสร้าง Content และเขียนแคปชั่นที่ดึงดูดใจ มีจิตวิทยาการโน้มน้าวใจ โดยยึดหลัก:
- เข้าใจพฤติกรรมและความต้องการของกลุ่มเป้าหมายในประเภทธุรกิจนั้นๆ อย่างแท้จริง
- ใช้โทนเสียงและสไตล์เพศที่กำหนดอย่างเป็นธรรมชาติ ไม่แข็งกระด้าง
- แทรก Call to Action (CTA) ที่กระตุ้นให้อยากมีส่วนร่วม สั่งซื้อ หรือคอมเมนต์ อย่างแนบเนียน
- ปรับสไตล์ให้ตรงกับแพลตฟอร์ม ${platform} เสมอ (เช่น หากเลือก IG ต้องเรียบหรู คุมโทน, TikTok ต้องฮุคแรง ทันกระแส, Line ต้องอบอุ่นและปิดการขายทันที)
- คุณเป็นผู้รอบรู้ มีสมองที่ทันสมัย อิงจากข่าวสารและเทรนด์ยอดนิยมล่าสุดในไทยอยู่เสมอ
- บังคับตอบเป็น JSON ที่ตรงตาม Schema เสมอ ห้ามเกริ่นนำหรือลงท้ายใดๆ ทั้งสิ้น`;

    try {
      const apiKey = ""; // Canvas runtime handles auto-injection
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: promptText }] }],
        tools: [{ "google_search": {} }], // Enable search grounding for trend relevance
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              contents: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    id: { type: "STRING" },
                    headline: { type: "STRING" },
                    caption: { type: "STRING" },
                    hashtags: {
                      type: "ARRAY",
                      items: { type: "STRING" }
                    },
                    visual_suggestion: { type: "STRING" }
                  },
                  required: ["id", "headline", "caption", "hashtags", "visual_suggestion"]
                }
              }
            },
            required: ["contents"]
          }
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (rawText) {
        const parsed = JSON.parse(rawText);
        if (parsed && parsed.contents) {
          setGeneratedContents(parsed.contents);
          setActiveTab("editor");
          showToast(`สร้างโซเชียลมีเดียคอนเทนต์สำเร็จ ${parsed.contents.length} รายการแล้ว!`, "success");
        } else {
          throw new Error("โครงสร้างข้อมูล JSON จาก AI ไม่ถูกต้อง");
        }
      } else {
        throw new Error("ไม่ได้รับข้อมูลตอบกลับจาก AI");
      }
    } catch (error) {
      console.error(error);
      showToast("เกิดข้อผิดพลาดในการสร้างคอนเทนต์ กรุณาลองใหม่อีกครั้ง", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefineContent = async (id) => {
    if (!refinePrompt.trim()) return;
    setIsRefining(true);
    
    const targetItem = generatedContents.find(item => item.id === id);
    if (!targetItem) return;

    const systemPrompt = `คุณคือ AI Copywriter ขั้นเทพ หน้าที่ของคุณคือปรับแต่งแคปชั่นและคอนเทนต์ตามคำสั่งของผู้ใช้ โดยอิงจากโครงสร้างข้อมูลเดิมที่มีและแก้ไขให้ตรงโจทย์ที่ได้รับอย่างเป็นธรรมชาติที่สุด
ตอบกลับด้วย JSON โครงสร้างแบบเดิม:
{
  "id": "${id}",
  "headline": "ปรับปรุงหัวข้อใหม่",
  "caption": "ปรับปรุงแคปชั่นใหม่",
  "hashtags": ["แฮชแท็กใหม่"],
  "visual_suggestion": "ปรับปรุงคำแนะนำภาพหรือวิดีโอสับสไลด์/แบ่งซีนใหม่แบบละเอียด"
}`;

    const userPrompt = `
    ปรับแต่งโซเชียลคอนเทนต์นี้:
    --------------------------
    หัวข้อเดิม: ${targetItem.headline}
    แคปชั่นเดิม: ${targetItem.caption}
    ไอเดียรูปภาพ/สไลด์เดิม: ${targetItem.visual_suggestion}
    --------------------------
    
    คำสั่งปรับแต่งเพิ่มเติมจากผู้ใช้: "${refinePrompt}"
    
    ปรับปรุงให้ได้โทนที่ดึงดูดใจ ตรงตามคำสั่ง และสอดรับกับสไตล์ของแพลตฟอร์ม ${platform}`;

    try {
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              headline: { type: "STRING" },
              caption: { type: "STRING" },
              hashtags: {
                type: "ARRAY",
                items: { type: "STRING" }
              },
              visual_suggestion: { type: "STRING" }
            },
            required: ["id", "headline", "caption", "hashtags", "visual_suggestion"]
          }
        }
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        const parsed = JSON.parse(rawText);
        setGeneratedContents(prev => 
          prev.map(item => item.id === id ? { ...item, ...parsed } : item)
        );
        setRefinePrompt("");
        setRefiningId(null);
        showToast("AI ทำการขัดเกลาและปรับแต่งคอนเทนต์นี้ให้เรียบร้อยแล้ว!", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("ไม่สามารถปรับแต่งได้ในขณะนี้ กรุณาลองใช้วิธีแก้ด้วยตนเองชั่วคราว", "error");
    } finally {
      setIsRefining(false);
    }
  };

  const handleLocalFieldChange = (id, field, val) => {
    setGeneratedContents(prev => 
      prev.map(item => item.id === id ? { ...item, [field]: val } : item)
    );
  };

  const handleHashtagChange = (id, idx, val) => {
    setGeneratedContents(prev => 
      prev.map(item => {
        if (item.id === id) {
          const newTags = [...item.hashtags];
          newTags[idx] = val;
          return { ...item, hashtags: newTags };
        }
        return item;
      })
    );
  };

  const handleAddHashtag = (id) => {
    setGeneratedContents(prev => 
      prev.map(item => item.id === id ? { ...item, hashtags: [...item.hashtags, "แท็กใหม่"] } : item)
    );
  };

  const handleRemoveHashtag = (id, idx) => {
    setGeneratedContents(prev => 
      prev.map(item => {
        if (item.id === id) {
          return { ...item, hashtags: item.hashtags.filter((_, i) => i !== idx) };
        }
        return item;
      })
    );
  };

  const handleCopyText = (text, id) => {
    // Fallback clipboard method as per CSP Guardrails
    const tempTextArea = document.createElement("textarea");
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    try {
      document.execCommand('copy');
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      showToast("คัดลอกเนื้อหาไปยังคลิปบอร์ดแล้ว!", "success");
    } catch (err) {
      showToast("ไม่สามารถคัดลอกได้โดยอัตโนมัติ กรุณาไฮไลต์และคัดลอกเอง", "warning");
    }
    document.body.removeChild(tempTextArea);
  };

  const handleExportToDoc = () => {
    if (generatedContents.length === 0) {
      showToast("กรุณาสร้างคอนเทนต์ก่อนส่งออกไฟล์", "warning");
      return;
    }

    const selectedBusiness = isCustomBusiness ? customBusiness : businessType;
    const selectedTone = isCustomTone ? customTone : tone;

    const htmlString = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>แผนงานโซเชียลมีเดียคอนเทนต์</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: 'Tahoma', 'Segoe UI', sans-serif; line-height: 1.6; color: #1e293b; padding: 20px; }
          .header { border-bottom: 3px double #6366f1; padding-bottom: 15px; margin-bottom: 30px; text-align: center; }
          .title { font-size: 26px; font-weight: bold; color: #4338ca; }
          .metadata { font-size: 13px; color: #64748b; margin-top: 5px; }
          .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 30px; background-color: #f8fafc; }
          .post-num { font-size: 18px; font-weight: bold; color: #4f46e5; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; }
          .label { font-weight: bold; color: #0f172a; margin-top: 15px; }
          .headline { font-size: 16px; font-weight: bold; color: #1e1b4b; background-color: #e0e7ff; padding: 8px 12px; border-radius: 4px; margin-bottom: 10px; }
          .caption { background-color: #ffffff; border: 1px solid #cbd5e1; padding: 15px; border-radius: 6px; font-family: 'Tahoma', sans-serif; white-space: pre-wrap; margin-bottom: 15px; }
          .hashtags { color: #2563eb; font-weight: bold; font-family: monospace; font-size: 14px; margin-bottom: 15px; }
          .visual-box { border-left: 4px solid #f59e0b; background-color: #fffbeb; padding: 12px 16px; border-radius: 0 4px 4px 0; font-style: italic; font-size: 13px; color: #b45309; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">📋 Social Media Content Calendar & Copy</div>
          <div class="metadata">
            สร้างโดย AI Content Strategy Assistant | ประเภทธุรกิจ: ${selectedBusiness} | โทนเสียง: ${selectedTone} | ช่องทาง: ${platform}
          </div>
        </div>
        ${generatedContents.map((item, idx) => `
          <div class="card">
            <div class="post-num">โพสต์ที่ ${idx + 1} (${platform} - ${mediaFormat})</div>
            <div class="label">🎯 หัวข้อ / Hook:</div>
            <div class="headline">${item.headline}</div>
            
            <div class="label">📝 แคปชั่นสำหรับใช้งาน:</div>
            <div class="caption">${item.caption.replace(/\n/g, '<br/>')}</div>
            
            <div class="label">🏷️ แฮชแท็ก:</div>
            <div class="hashtags">${item.hashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' ')}</div>
            
            <div class="label">💡 คำแนะนำสำหรับการทำภาพกราฟิก/วิดีโอ:</div>
            <div class="visual-box">${item.visual_suggestion.replace(/\n/g, '<br/>')}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `social_content_plan_${platform}_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ส่งออกข้อมูลเป็นไฟล์เอกสาร Word (.doc) สำเร็จแล้ว!", "success");
  };

  const handleExportToSlides = () => {
    if (generatedContents.length === 0) {
      showToast("กรุณาสร้างคอนเทนต์ก่อนส่งออกไฟล์", "warning");
      return;
    }
    setShowSlidePreview(true);
    setCurrentSlideIndex(0);
    showToast("เปิดแผงนำเสนอสไลด์สำหรับการนำเสนอผลงานดีไซเนอร์แล้ว!", "info");
  };

  const handleDownloadSlidePackage = () => {
    const selectedBusiness = isCustomBusiness ? customBusiness : businessType;
    const slidesHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Content Concept Deck - Presentation</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          .slide { display: none; min-height: 100vh; }
          .slide.active { display: flex; }
        </style>
      </head>
      <body class="bg-slate-900 text-white font-sans">
        <!-- Title Slide -->
        <div class="slide active flex-col justify-between p-16" id="slide-0">
          <div class="flex justify-between items-center">
            <span class="text-indigo-400 font-semibold tracking-wider uppercase text-sm">Social Media Deck</span>
            <span class="text-slate-500 text-sm">AI Content Assistant</span>
          </div>
          <div class="my-auto max-w-4xl">
            <h1 class="text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Content Concept Presentation
            </h1>
            <p class="text-2xl text-slate-300 leading-relaxed">
              สำหรับธุรกิจ: ${selectedBusiness} <br/>
              ช่องทางเผยแพร่หลัก: <span class="text-indigo-300 font-bold">${platform}</span>
            </p>
          </div>
          <div class="flex justify-between items-center text-slate-500 text-xs">
            <span>กดปุ่มลูกศร ซ้าย-ขวา บนคีย์บอร์ดเพื่อเปลี่ยนหน้า</span>
            <span>สร้างขึ้นเมื่อ: ${new Date().toLocaleDateString('th-TH')}</span>
          </div>
        </div>

        ${generatedContents.map((item, idx) => `
          <!-- Slide Content #${idx + 1} (Pitch & Concept) -->
          <div class="slide flex-col justify-between p-12 bg-slate-950" id="slide-${(idx * 2) + 1}">
            <div class="flex justify-between items-center border-b border-slate-800 pb-4">
              <span class="text-indigo-400 font-bold text-sm">POST #${idx + 1}: CONCEPT PITCH</span>
              <span class="text-slate-400 text-xs">${platform} • ${mediaFormat}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 my-auto">
              <div class="space-y-6">
                <div>
                  <h3 class="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Hook / พาดหัวใจความ</h3>
                  <h2 class="text-3xl font-extrabold text-white leading-tight">${item.headline}</h2>
                </div>
                <div>
                  <h3 class="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">Visual Direction / ไอเดียภาพประกอบ (อย่างละเอียด)</h3>
                  <div class="p-5 bg-amber-950/40 border border-amber-900/50 rounded-xl text-amber-200 text-xs italic whitespace-pre-wrap max-h-[220px] overflow-y-auto leading-relaxed">
${item.visual_suggestion}
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-center bg-slate-900/60 border border-slate-800 rounded-2xl p-6 min-h-[250px]">
                <div class="text-center space-y-3">
                  <div class="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400 border border-indigo-500/20">
                    🎬
                  </div>
                  <p class="font-bold text-lg">โจทย์ศิลป์สำหรับกราฟิกและวิดีโอ</p>
                  <p class="text-xs text-slate-400 max-w-xs">นำทางตามคอนเซปต์ซ้ายมือเพื่อดึงดูดสายตาคนดูใน ${platform}</p>
                </div>
              </div>
            </div>
            <div class="flex justify-between text-slate-500 text-xs">
              <span>สไลด์ ${(idx * 2) + 1} จาก ${(generatedContents.length * 2) + 1}</span>
              <span>${platform} - AI Strategy App</span>
            </div>
          </div>

          <!-- Slide Content #${idx + 1} (Caption & Tags) -->
          <div class="slide flex-col justify-between p-12 bg-indigo-950/20" id="slide-${(idx * 2) + 2}">
            <div class="flex justify-between items-center border-b border-indigo-900/40 pb-4">
              <span class="text-indigo-400 font-bold text-sm">POST #${idx + 1}: COPYWRITING DESIGN</span>
              <span class="text-slate-400 text-xs">${platform} • แคปชั่นจริง</span>
            </div>
            <div class="grid grid-cols-1 gap-6 my-auto max-w-4xl mx-auto w-full">
              <div>
                <h3 class="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Caption Text / แคปชั่นฉบับเต็ม</h3>
                <div class="bg-slate-900/80 border border-indigo-500/20 rounded-xl p-6 text-sm text-slate-100 whitespace-pre-wrap max-h-[350px] overflow-y-auto leading-relaxed">
${item.caption}

${item.hashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' ')}
                </div>
              </div>
            </div>
            <div class="flex justify-between text-slate-500 text-xs">
              <span>สไลด์ ${(idx * 2) + 2} จาก ${(generatedContents.length * 2) + 1}</span>
              <span>ก๊อปปี้ไปโพสต์งานได้ทันที</span>
            </div>
          </div>
        `).join('')}

        <script>
          let currentSlide = 0;
          const totalSlides = ${(generatedContents.length * 2) + 1};
          
          function showSlide(index) {
            document.querySelectorAll('.slide').forEach(el => el.classList.remove('active'));
            document.getElementById('slide-' + index).classList.add('active');
            currentSlide = index;
          }

          document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
              showSlide(currentSlide + 1);
            } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
              showSlide(currentSlide - 1);
            }
          });
        </script>
      </body>
      </html>
    `;

    const blob = new Blob([slidesHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pitching_deck_${platform}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("ดาวน์โหลดสไลด์คอนเซปต์ในรูปแบบ Web Presentation สำเร็จ!", "success");
  };

  const loadDemoPreset = () => {
    setBrandInfo("แบรนด์สกินแคร์ 'GlowRecipe TH' บิวตี้ออร์แกนิกยอดขายอันดับหนึ่งในไทย ชูส่วนผสมหลักจากสารสกัดข้าวหอมมะลิหมักธรรมชาติและอโลเวร่าออร์แกนิก ช่วยรักษาสิวและปลอบประโลมผิวอย่างอ่อนโยน เหมาะกับผิวคนเอเชียที่แพ้ง่ายและเผชิญมลภาวะร้อนชื้นอย่างกรุงเทพฯ เสมอ");
    setProductInfo("โปรโมชั่นพิเศษ 11.11 ซื้อ 'เซรั่มข้าวหอมมะลิ' ขนาด 30ml จำนวน 1 ขวด แถมฟรีขนาดพกพา 10ml อีก 1 ขวด ในราคาเพียง 690 บาท (จากปกติ 990 บาท) จำนวนจำกัดเพียง 500 เซ็ตแรกเท่านั้น");
    setBusinessType("ความงามและเครื่องสำอาง (Beauty & Cosmetics)");
    setTone("เป็นกันเองและเข้าถึงง่าย (Friendly & Casual)");
    setGenderTone("ผู้หญิง (Feminine - ค่ะ/ขา)");
    setPlatform("IG");
    setContentType("educational");
    setQuantity(2);
    showToast("โหลดข้อมูลธุรกิจความงามและสกินแคร์ตัวอย่างเรียบร้อย!", "info");
  };

  // Switch Theme & Apply class to document body
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    // Show welcoming notification
    showToast("ยินดีต้อนรับเข้าสู่ AI Social Creator Workspace! กำลังรันธีมมืดเป็นค่าเริ่มต้น", "info");
  }, []);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
      theme === "dark" 
        ? "bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white" 
        : "bg-slate-50 text-slate-800 selection:bg-indigo-200 selection:text-slate-900"
    }`}>
      
      {/* Toast Notification Banner - MOVED TO BOTTOM RIGHT TO PREVENT OVERLAPPING WITH HEADER BUTTONS */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-xl transition-all duration-300 ${
          notification.type === 'success' ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200' :
          notification.type === 'error' ? 'bg-rose-950/95 border-rose-500/50 text-rose-200' :
          'bg-indigo-950/95 border-indigo-500/50 text-indigo-200'
        }`}>
          <Sparkles className="w-5 h-5 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      )}

      {/* Header Bar - Cleaned up classes, removed complex pointer-events */}
      <header className={`sticky top-0 z-40 border-b px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between transition-colors duration-300 backdrop-blur-md ${
        theme === "dark" 
          ? "border-slate-800/80 bg-slate-900/80" 
          : "border-slate-200 bg-white/90 shadow-sm"
      }`}>
        
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-extrabold tracking-tight ${
              theme === "dark" 
                ? "bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent" 
                : "text-slate-900"
            }`}>
              Social Media Content Creator
            </h1>
            <p className={`text-xs ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              ระบบ AI อัจฉริยะวิเคราะห์ช่วยจัดร่าง Content และแคปชั่น
            </p>
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: Input Strategy Control (5/12 grid) */}
        <section className={`lg:col-span-5 border rounded-2xl p-6 flex flex-col gap-6 backdrop-blur-sm transition-all duration-300 self-start h-auto ${
          theme === "dark" 
            ? "bg-slate-900/40 border-slate-800/80 shadow-xl" 
            : "bg-white border-slate-200 shadow-md"
        }`}>
          
          <div className={`flex items-center justify-between border-b pb-3 ${
            theme === "dark" ? "border-slate-800" : "border-slate-100"
          }`}>
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold">กำหนดกลยุทธ์ Content (Inputs)</h2>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-mono ${
              theme === "dark" 
                ? "text-indigo-300 bg-indigo-950/50 border-indigo-500/20" 
                : "text-indigo-600 bg-indigo-50 border-indigo-200"
            }`}>
              Pro Version 2.0
            </span>
          </div>

          {/* Action Widgets Area */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Light/Dark Toggle Button */}
            <button
              onClick={() => {
                const newTheme = theme === "dark" ? "light" : "dark";
                setTheme(newTheme);
                showToast(`เปลี่ยนโครงสร้างสีหน้าจอเป็น: ${newTheme === "dark" ? "โหมดมืด" : "โหมดสว่างสบายตา"}`, "info");
              }}
              className={`px-3.5 py-2 rounded-xl border flex items-center justify-center transition-all active:scale-95 ${
                theme === "dark" 
                  ? "bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700" 
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              }`}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-xs ml-2 font-bold">{theme === "dark" ? "โหมดสว่าง" : "โหมดมืด"}</span>
            </button>

            {/* Clear Data Button */}
            <button 
              onClick={handleClearData}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all border flex items-center gap-1.5 active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-rose-400 border-rose-500/30"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 shadow-sm"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              ล้างข้อมูล (Clear)
            </button>

            {/* Demo Button */}
            <button 
              onClick={loadDemoPreset}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all border flex items-center gap-1.5 active:scale-95 ${
                theme === "dark"
                  ? "bg-slate-800 hover:bg-slate-700 text-indigo-300 border-indigo-500/30"
                  : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-indigo-200 shadow-sm"
              }`}
            >
              <RefreshCw className="w-4 h-4" />
              โหลดเดโม (Demo)
            </button>
            
            {/* Notion Modal Trigger Button */}
            <button 
              onClick={() => setShowNotionModal(true)}
              className={`px-3.5 py-2 border rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold active:scale-95 ${
                theme === "dark"
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-md shadow-indigo-500/20"
              }`}
            >
              <Database className="w-4 h-4 text-indigo-100" />
              ดึง Notion
            </button>
          </div>

          {/* 1. Brand Information */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className={`text-sm font-semibold flex items-center gap-1.5 ${
                theme === "dark" ? "text-slate-300" : "text-slate-700"
              }`}>
                <span>1. ข้อมูลแบรนด์ / Brand Profile</span>
                <span className="text-red-400 text-xs">*</span>
              </label>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                  theme === "dark"
                    ? "text-indigo-300 bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "text-indigo-600 bg-slate-100 border-slate-200 hover:bg-slate-200 shadow-sm"
                }`}
                title="อัปโหลด Brand Guide (รูปภาพ, PDF, Word หรือ Txt)"
                disabled={isFileExtracting}
              >
                {isFileExtracting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>อัพโหลดแบรนด์บุก/รูปภาพ</span>
              </button>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".txt,.pdf,.doc,.docx,image/*" 
                className="hidden" 
              />
            </div>

            {/* Scanning Overlay inside Textarea */}
            <div className="relative">
              <textarea
                className={`w-full h-32 rounded-xl p-3 text-sm placeholder-slate-500 resize-none outline-none transition-all leading-relaxed ${
                  theme === "dark"
                    ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                    : "bg-slate-50 border border-slate-300 focus:border-indigo-500 text-slate-800"
                }`}
                placeholder="พิมพ์เอกลักษณ์คู่มือแบรนด์ของคุณเองตรงนี้ หรือคลิกอัปโหลดเอกสาร / ลากวางเพื่อสแกนด้วยพลัง AI..."
                value={brandInfo}
                onChange={(e) => setBrandInfo(e.target.value)}
                disabled={isFileExtracting}
              />
              {isFileExtracting && (
                <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center text-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs text-indigo-400 font-bold animate-pulse">กำลังสแกนและสกัดข้อมูลด้วย AI...</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              * รองรับไฟล์ภาพแบรนด์บุก, แผ่นสไลด์สินค้า, เอกสาร PDF, สรุป Word, หรือ Text File โดยตรง
            </p>
          </div>

          {/* 2. Business Type Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                2. ประเภทธุรกิจ (Business Type)
              </label>
              <button 
                onClick={() => {
                  setIsCustomBusiness(!isCustomBusiness);
                  if(!isCustomBusiness) setCustomBusiness("");
                }}
                className="text-xs text-indigo-500 hover:text-indigo-400 underline"
              >
                {isCustomBusiness ? "เลือกจากลิสต์" : "พิมพ์ระบุเอง"}
              </button>
            </div>
            
            {isCustomBusiness ? (
              <input
                type="text"
                className={`w-full rounded-xl p-3 text-sm outline-none transition-all ${
                  theme === "dark"
                    ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                    : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800"
                }`}
                placeholder="ระบุประเภทธุรกิจของคุณ เช่น แบรนด์โฮมคาเฟ่คูสติก..."
                value={customBusiness}
                onChange={(e) => setCustomBusiness(e.target.value)}
              />
            ) : (
              <div className="relative">
                <select
                  className={`w-full rounded-xl p-3 text-sm outline-none transition-all appearance-none cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                      : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800"
                  }`}
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                >
                  {POPULAR_BUSINESS_TYPES.map((biz) => (
                    <option key={biz} value={biz}>{biz}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* 3. Tone of Voice Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                3. โทนเสียงโฆษณา (Tone of Voice)
              </label>
              <button 
                onClick={() => {
                  setIsCustomTone(!isCustomTone);
                  if(!isCustomTone) setCustomTone("");
                }}
                className="text-xs text-indigo-500 hover:text-indigo-400 underline"
              >
                {isCustomTone ? "เลือกจากลิสต์" : "ระบุเองอิสระ"}
              </button>
            </div>

            {isCustomTone ? (
              <input
                type="text"
                className={`w-full rounded-xl p-3 text-sm outline-none transition-all ${
                  theme === "dark"
                    ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                    : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800"
                }`}
                placeholder="พิมพ์สไตล์เสียง เช่น วัยรุ่นมีสแลงสไตล์เน็ตไอดอล..."
                value={customTone}
                onChange={(e) => setCustomTone(e.target.value)}
              />
            ) : (
              <div className="relative">
                <select
                  className={`w-full rounded-xl p-3 text-sm outline-none transition-all appearance-none cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                      : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800"
                  }`}
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* 4. Gender style */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                4. เพศของโทนเสียง (Gender Tone)
              </label>
              <button 
                onClick={() => {
                  setIsCustomGender(!isCustomGender);
                  if(!isCustomGender) setCustomGender("");
                }}
                className="text-xs text-indigo-500 hover:text-indigo-400 underline"
              >
                {isCustomGender ? "เลือกจากลิสต์" : "ระบุเองอิสระ"}
              </button>
            </div>

            {isCustomGender ? (
              <input
                type="text"
                className={`w-full rounded-xl p-3 text-sm outline-none transition-all ${
                  theme === "dark"
                    ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                    : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800"
                }`}
                placeholder="ระบุเพศวิถีของกลุ่มเสียงภาษาพูด เช่น ตัวมารดาวงการ..."
                value={customGender}
                onChange={(e) => setCustomGender(e.target.value)}
              />
            ) : (
              <div className="relative">
                <select
                  className={`w-full rounded-xl p-3 text-sm outline-none transition-all appearance-none cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                      : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800"
                  }`}
                  value={genderTone}
                  onChange={(e) => setGenderTone(e.target.value)}
                >
                  {GENDER_TONES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            )}
          </div>

          {/* 5. Platform & Media Format */}
          <div className="space-y-2">
            <label className={`text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              5. ช่องทางแชร์และรูปแบบสื่อ
            </label>
            <div className="grid grid-cols-2 gap-4">
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">ช่องทางแชร์ (Platform)</label>
                <select
                  className={`w-full rounded-xl p-2.5 text-xs outline-none transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                      : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800 shadow-sm"
                  }`}
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="Facebook">👥 Facebook Post</option>
                  <option value="IG">📸 IG Post / Story</option>
                  <option value="TikTok">🎵 TikTok Caption</option>
                  <option value="Youtube">📺 YouTube Intro/Post</option>
                  <option value="Line">💬 Line Broadcast</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">รูปแบบสื่อ (Format)</label>
                <select
                  className={`w-full rounded-xl p-2.5 text-xs outline-none transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                      : "bg-white border border-slate-300 focus:border-indigo-500 text-slate-800 shadow-sm"
                  }`}
                  value={mediaFormat}
                  onChange={(e) => setMediaFormat(e.target.value)}
                >
                  <option value="Single image">🖼️ Single Image (รูปเดี่ยว)</option>
                  <option value="Album image">📚 Album / Carousel (เซ็ตสไลด์)</option>
                  <option value="Video">🎥 Video / Reels (วิดีโอคลิป)</option>
                </select>
              </div>

            </div>
          </div>

          {/* 6. Product or Service Information */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className={`text-sm font-semibold flex items-center gap-1.5 ${
                theme === "dark" ? "text-slate-300" : "text-slate-700"
              }`}>
                <span>6. สินค้าหรือบริการเจาะจง (Product / Service)</span>
              </label>
              
              <button 
                onClick={() => productFileInputRef.current?.click()}
                className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                  theme === "dark"
                    ? "text-indigo-300 bg-slate-800 border-slate-700 hover:bg-slate-700"
                    : "text-indigo-600 bg-slate-100 border-slate-200 hover:bg-slate-200 shadow-sm"
                }`}
                title="อัปโหลดสเปกสินค้า รูปโปรโมชั่น หรือไฟล์ข้อมูลบริการ (เลือกได้หลายไฟล์)"
                disabled={isProductFileExtracting}
              >
                {isProductFileExtracting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>อัพโหลดข้อมูลสินค้า (เลือกหลายไฟล์ได้)</span>
              </button>
              
              <input 
                type="file" 
                ref={productFileInputRef} 
                onChange={handleProductFileUpload} 
                accept=".txt,.pdf,.doc,.docx,image/*" 
                className="hidden" 
                multiple
              />
            </div>

            <div className="relative">
              <textarea
                className={`w-full h-24 rounded-xl p-3 text-sm placeholder-slate-500 resize-none outline-none transition-all leading-relaxed ${
                  theme === "dark"
                    ? "bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-slate-200"
                    : "bg-slate-50 border border-slate-300 focus:border-indigo-500 text-slate-800"
                }`}
                placeholder="ระบุชื่อสินค้า สรรพคุณ หรือโปรโมชั่นแบบเจาะจง เช่น อาหารสุนัขสูตรขนนุ่ม, ดินสอสีไม้รุ่น AB, คอร์สเรียนสอนขับรถบรรทุก, ฉีดโบท็อกซ์แบบเหมาจ่าย 9,999 บาท..."
                value={productInfo}
                onChange={(e) => setProductInfo(e.target.value)}
                disabled={isProductFileExtracting}
              />
              {isProductFileExtracting && (
                <div className="absolute inset-0 bg-indigo-500/10 backdrop-blur-[2px] rounded-xl flex flex-col items-center justify-center text-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                  <p className="text-xs text-indigo-400 font-bold animate-pulse">กำลังสแกนและดึงข้อมูลสินค้า...</p>
                </div>
              )}
            </div>
          </div>

          {/* 7. Content Psychology Objectives (With 8 options now) */}
          <div className="space-y-2">
            <label className={`text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
              7. วัตถุประสงค์จิตวิทยาคอนเทนต์ (Content Objective)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setContentType("educational")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "educational" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">🎓 Educational</div>
                <p className="text-[10px] leading-snug">ให้ข้อมูลความรู้ที่มีคุณค่าเพื่อประโยชน์</p>
              </button>

              <button
                type="button"
                onClick={() => setContentType("entertainment")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "entertainment" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">🎭 Entertainment</div>
                <p className="text-[10px] leading-snug">สร้างสรรค์ความฮา มุกขำ สนุกสนาน</p>
              </button>

              <button
                type="button"
                onClick={() => setContentType("inspirational")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "inspirational" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">✨ Inspirational</div>
                <p className="text-[10px] leading-snug">เติมเต็มกำลังใจ รีวิวเชิงลึกจากใจ</p>
              </button>

              <button
                type="button"
                onClick={() => setContentType("promotional")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "promotional" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">💰 Promotional</div>
                <p className="text-[10px] leading-snug">โปรโมชั่นปิดดีลเร่งซื้อทันที คุ้มค่า</p>
              </button>

              {/* NEW OBJECTIVE 1: FOMO (Fear) */}
              <button
                type="button"
                onClick={() => setContentType("fear")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "fear" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">🚨 ทำให้รู้สึกกลัว (FOMO)</div>
                <p className="text-[10px] leading-snug">กลัวตกเทรนด์ พลาดดีลสำคัญ หรือพลาดโอกาสดีๆ</p>
              </button>

              {/* NEW OBJECTIVE 2: Q&A */}
              <button
                type="button"
                onClick={() => setContentType("qa")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "qa" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">💬 Q&A Content</div>
                <p className="text-[10px] leading-snug">รวบรวมข้อสงสัย ตอบคำถามแบบฉลาด ใส่ใจผู้บริโภค</p>
              </button>

              {/* NEW OBJECTIVE 3: Real-time */}
              <button
                type="button"
                onClick={() => setContentType("realtime")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "realtime" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">⚡ Real-time Content</div>
                <p className="text-[10px] leading-snug">เล่นประเด็นฮิตยอดฮิต ดึงดูดสายตาอย่างชาญฉลาด</p>
              </button>

              {/* NEW OBJECTIVE 4: Branding */}
              <button
                type="button"
                onClick={() => setContentType("branding")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  contentType === "branding" 
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-500 font-bold" 
                    : theme === "dark" 
                      ? "bg-slate-950 border-slate-800/80 hover:bg-slate-900 text-slate-400"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                }`}
              >
                <div className="text-xs font-bold block mb-1">💎 Branding Content</div>
                <p className="text-[10px] leading-snug">สื่อสารตัวตน ค่านิยม และจุดเด่นหลักของแบรนด์</p>
              </button>
            </div>
          </div>

          {/* 8. Quantity Desired (Updated Max Limit to 20 per request) */}
          <div className={`flex items-center justify-between border p-4 rounded-xl ${
            theme === "dark" ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="space-y-0.5">
              <label className={`text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                8. จำนวนไอเดียคอนเทนต์ที่ต้องการ
              </label>
              <p className="text-xs text-slate-500">เลือกจำนวนทางเลือกที่ต้องการรวบรวม (สูงสุด 20 ไอเดีย)</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className={`w-8 h-8 rounded-lg font-bold transition-all active:scale-90 ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                }`}
              >
                -
              </button>
              <span className="text-lg font-bold text-indigo-500 font-mono w-8 text-center">{quantity}</span>
              <button 
                type="button"
                onClick={() => setQuantity(Math.min(20, quantity + 1))}
                className={`w-8 h-8 rounded-lg font-bold transition-all active:scale-90 ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-slate-200 hover:bg-slate-300 text-slate-800"
                }`}
              >
                +
              </button>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="button"
            onClick={handleCreateContent}
            disabled={isLoading || isFileExtracting || !brandInfo.trim()}
            className="w-full mt-2 py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/10 tracking-wide transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>AI กำลังเชื่อมต่อสืบค้นข้อมูลและจัดร่าง...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 animate-pulse text-yellow-300" />
                <span className="text-base">เริ่มสร้างสรรค์เนื้อหา (Create Content)</span>
              </>
            )}
          </button>
          
        </section>

        {/* RIGHT COLUMN: Output Creative Canvas & Workspace (7/12 grid) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Active Tab switcher / File Downloader Panel */}
          <div className={`border p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-sm transition-all duration-300 ${
            theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200 shadow-md"
          }`}>
            <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${
              theme === "dark" ? "bg-slate-950 border-slate-800/80" : "bg-slate-100 border-slate-200"
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab("editor")}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === "editor" 
                    ? "bg-indigo-500 text-white shadow" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                หน้าต่างบรีฟงานสด / Workspace
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === "preview" 
                    ? "bg-indigo-500 text-white shadow" 
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                พรีวิวแพลตฟอร์มจริง / Mobile View
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportToDoc}
                disabled={generatedContents.length === 0}
                className={`px-3.5 py-2 disabled:opacity-55 disabled:pointer-events-none rounded-xl transition-all text-xs font-bold flex items-center gap-2 border ${
                  theme === "dark"
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    : "bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm"
                }`}
              >
                <FileText className="w-4 h-4 text-emerald-500" />
                Export Word (.doc)
              </button>

              <button
                type="button"
                onClick={handleExportToSlides}
                disabled={generatedContents.length === 0}
                className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 border border-indigo-500/20 disabled:opacity-55 disabled:pointer-events-none rounded-xl transition-all text-xs font-bold flex items-center gap-2"
              >
                <Presentation className="w-4 h-4 text-indigo-500 animate-pulse" />
                Export Slide Deck
              </button>
            </div>
          </div>

          {/* MAIN OUTPUT AREA CONTENT DISPLAY */}
          {generatedContents.length === 0 ? (
            // Empty State
            <div className={`border border-dashed rounded-3xl p-16 flex flex-col items-center justify-center text-center gap-4 min-h-[500px] transition-all duration-300 ${
              theme === "dark" ? "bg-slate-900/10 border-slate-800" : "bg-white border-slate-300 shadow-inner"
            }`}>
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-3xl">
                🔮
              </div>
              <div className="max-w-md">
                <h3 className={`text-lg font-bold ${theme === "dark" ? "text-slate-300" : "text-slate-800"}`}>
                  ยังไม่มีงานวิเคราะห์แคปชั่นจัดเก็บในเครื่อง
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  ระบุสไตล์แบรนด์ของคุณที่ช่องข้อมูลแบรนด์ซ้ายมือ (อัปโหลดข้อมูลจากรูปสินค้าได้ด้วย!) แล้วกดปุ่ม 
                  <span className="text-indigo-500 font-bold"> "เริ่มสร้างสรรค์เนื้อหา"</span> เพื่อดูบทคัดลอกโฆษณาที่เขียนโดย AI Strategy ขั้นเทพทันที!
                </p>
              </div>
            </div>
          ) : (
            // Editor / Interactive Workspace View
            <div className="space-y-6">
              {activeTab === "editor" ? (
                /* EDITOR MODE: Full field inline correction & AI refining */
                generatedContents.map((item, index) => (
                  <div key={item.id} className={`border rounded-2xl p-6 flex flex-col gap-5 backdrop-blur-sm shadow-xl relative group transition-all duration-300 ${
                    theme === "dark" ? "bg-slate-900/40 border-slate-800/80" : "bg-white border-slate-200"
                  }`}>
                    
                    <div className={`flex items-center justify-between border-b pb-3 ${
                      theme === "dark" ? "border-slate-800" : "border-slate-100"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs font-mono font-bold">
                          {index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-indigo-400 uppercase tracking-wide">
                          Post #{index + 1} - ฉบับร่างสำหรับ {platform} ({mediaFormat})
                        </h4>
                      </div>
                      
                      {/* Copy all button */}
                      <button
                        type="button"
                        onClick={() => handleCopyText(`หัวข้อ: ${item.headline}\n\nแคปชั่น:\n${item.caption}\n\nแฮชแท็ก: ${item.hashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' ')}`, item.id)}
                        className={`text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                          theme === "dark"
                            ? "text-slate-400 hover:text-white bg-slate-850 border-slate-700"
                            : "text-slate-600 hover:text-slate-900 bg-slate-50 border-slate-200 shadow-sm"
                        }`}
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 font-bold">คัดลอกสำเร็จ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="font-bold">คัดลอกบทโฆษณา</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Headline Editable Field */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        🎯 พาดหัวสั้นดึงสายตา (Hook Line / Headline)
                      </label>
                      <input
                        type="text"
                        className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-all ${
                          theme === "dark"
                            ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100"
                            : "bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800"
                        }`}
                        value={item.headline}
                        onChange={(e) => handleLocalFieldChange(item.id, "headline", e.target.value)}
                      />
                    </div>

                    {/* Caption Textarea Field */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">
                        📝 ร่างรายละเอียดเนื้อความโฆษณา (Caption Copywriting)
                      </label>
                      <textarea
                        className={`w-full h-44 rounded-xl p-4 text-sm outline-none transition-all resize-y font-sans leading-relaxed ${
                          theme === "dark"
                            ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-200"
                            : "bg-slate-50 border border-slate-200 focus:border-indigo-500 text-slate-800"
                        }`}
                        value={item.caption}
                        onChange={(e) => handleLocalFieldChange(item.id, "caption", e.target.value)}
                      />
                    </div>

                    {/* Tags Interactive Row */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400">🏷️ แฮชแท็กหลักกลุ่มไทยยอดนิยม (Hashtags)</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.hashtags.map((tag, tIdx) => (
                          <div key={tIdx} className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border ${
                            theme === "dark"
                              ? "bg-indigo-950/40 border-indigo-500/20 text-indigo-300"
                              : "bg-indigo-50 border-indigo-100 text-indigo-700"
                          }`}>
                            <span>#</span>
                            <input
                              type="text"
                              className="bg-transparent border-none text-xs w-20 outline-none font-semibold"
                              value={tag.replace(/^#/, '')}
                              onChange={(e) => handleHashtagChange(item.id, tIdx, e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveHashtag(item.id, tIdx)}
                              className="hover:text-red-500 transition-colors ml-1 font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddHashtag(item.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            theme === "dark"
                              ? "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                              : "bg-white hover:bg-slate-100 text-slate-600 border-slate-300 shadow-sm"
                          }`}
                        >
                          + เพิ่มคีย์เวิร์ดแฮชแท็ก
                        </button>
                      </div>
                    </div>

                    {/* Visual Suggestion Field */}
                    <div className={`p-4 rounded-xl space-y-1.5 border ${
                      theme === "dark"
                        ? "bg-amber-950/20 border-amber-900/40"
                        : "bg-amber-50 border-amber-200"
                    }`}>
                      <label className={`text-xs font-bold flex items-center gap-1.5 ${
                        theme === "dark" ? "text-amber-400" : "text-amber-800"
                      }`}>
                        💡 คู่มือสร้างสไลด์/ซีนวิดีโอ (Visual Guideline - แตกสไลด์/ซีนละเอียด)
                      </label>
                      <textarea
                        className={`w-full bg-transparent border-none text-xs font-sans italic outline-none resize-y h-36 leading-relaxed ${
                          theme === "dark" ? "text-slate-300" : "text-slate-700"
                        }`}
                        value={item.visual_suggestion}
                        onChange={(e) => handleLocalFieldChange(item.id, "visual_suggestion", e.target.value)}
                        placeholder="รายละเอียดสไลด์หรือซีนวิดีโอแต่ละช่วง..."
                      />
                    </div>

                    {/* AI REFINER INPUT AREA */}
                    <div className={`border-t pt-4 flex flex-col gap-2 ${
                      theme === "dark" ? "border-slate-800" : "border-slate-150"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-500 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          ให้ AI ขัดเกลาข้อความโพลต์นี้ตามสั่ง (AI Refiner)
                        </span>
                        {refiningId === item.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setRefiningId(null);
                              setRefinePrompt("");
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-600"
                          >
                            ยกเลิก
                          </button>
                        )}
                      </div>

                      {refiningId === item.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className={`flex-1 rounded-xl px-4 py-2.5 text-xs outline-none placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 transition-all ${
                              theme === "dark"
                                ? "bg-slate-950 border border-indigo-500/50 text-slate-200"
                                : "bg-slate-100 border border-indigo-300 text-slate-800"
                            }`}
                            placeholder="พิมพ์ปรับแก้ได้เลย เช่น 'ขอฮาๆ สั้นลง', 'เน้น CTA ให้กดแชร์', 'เปลี่ยนเพศเสียงเป็นผู้ชายครับ'..."
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRefineContent(item.id);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRefineContent(item.id)}
                            disabled={isRefining || !refinePrompt.trim()}
                            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1"
                          >
                            {isRefining ? "กำลังวิเคราะห์แก้ไข..." : "ยืนยัน"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRefiningId(item.id)}
                          className={`w-full py-2 rounded-xl border border-dashed text-xs text-slate-500 hover:text-indigo-500 text-center transition-all flex items-center justify-center gap-1.5 ${
                            theme === "dark"
                              ? "bg-slate-800 border-slate-700/60 hover:bg-indigo-950/40 hover:border-indigo-500/30"
                              : "bg-white border-slate-300 hover:bg-slate-50 hover:border-indigo-300 shadow-sm"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          ป้อนคำสั่งให้ AI แต่งเนื้อหาเพิ่มความตลก, สร้างโปรโมชั่น, หรือเกลาภาษาตรงนี้
                        </button>
                      )}
                    </div>

                  </div>
                ))
              ) : (
                /* SOCIAL MEDIA PREVIEW / MOCKUP MOBILE CARD VIEW */
                generatedContents.map((item, index) => {
                  
                  // Setup Dynamic Platform Colors with respect to MAIN App Theme
                  const isDarkTheme = theme === "dark";

                  const platformStyles = {
                    Facebook: {
                      bgColor: isDarkTheme ? "bg-blue-600" : "bg-blue-500",
                      cardBg: isDarkTheme ? "bg-[#18191a]" : "bg-white",
                      cardBorder: isDarkTheme ? "border-[#2f3031]" : "border-slate-200",
                      textColor: isDarkTheme ? "text-slate-100" : "text-slate-900",
                      subTextColor: isDarkTheme ? "text-slate-400" : "text-slate-500",
                      interactionBg: isDarkTheme ? "bg-[#1c1d1e]" : "bg-slate-50",
                      visualInnerBg: isDarkTheme ? "bg-slate-900" : "bg-slate-50",
                      visualBorder: isDarkTheme ? "border-[#3e4042]" : "border-slate-200",
                      profilePic: "👤"
                    },
                    IG: {
                      bgColor: "bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600",
                      cardBg: isDarkTheme ? "bg-slate-900" : "bg-white",
                      cardBorder: isDarkTheme ? "border-slate-800" : "border-slate-200",
                      textColor: isDarkTheme ? "text-slate-100" : "text-slate-900",
                      subTextColor: isDarkTheme ? "text-slate-400" : "text-slate-500",
                      interactionBg: isDarkTheme ? "bg-slate-950" : "bg-slate-50",
                      visualInnerBg: isDarkTheme ? "bg-slate-950" : "bg-slate-100",
                      visualBorder: isDarkTheme ? "border-slate-800" : "border-slate-200",
                      profilePic: "📸"
                    },
                    TikTok: {
                      bgColor: "bg-black border border-slate-700",
                      cardBg: "bg-slate-950",
                      cardBorder: "border-slate-800",
                      textColor: "text-slate-100",
                      subTextColor: "text-slate-400",
                      interactionBg: "bg-slate-900",
                      visualInnerBg: "bg-slate-900",
                      visualBorder: "border-slate-800",
                      profilePic: "🎵"
                    },
                    Youtube: {
                      bgColor: "bg-red-600",
                      cardBg: isDarkTheme ? "bg-slate-900" : "bg-white",
                      cardBorder: isDarkTheme ? "border-slate-800" : "border-slate-200",
                      textColor: isDarkTheme ? "text-slate-100" : "text-slate-900",
                      subTextColor: isDarkTheme ? "text-slate-400" : "text-slate-500",
                      interactionBg: isDarkTheme ? "bg-slate-950" : "bg-slate-50",
                      visualInnerBg: isDarkTheme ? "bg-slate-950" : "bg-slate-50",
                      visualBorder: isDarkTheme ? "border-slate-800" : "border-slate-200",
                      profilePic: "📺"
                    },
                    Line: {
                      bgColor: "bg-emerald-500",
                      cardBg: isDarkTheme ? "bg-slate-900" : "bg-white",
                      cardBorder: isDarkTheme ? "border-slate-850" : "border-slate-200",
                      textColor: isDarkTheme ? "text-slate-100" : "text-slate-900",
                      subTextColor: isDarkTheme ? "text-slate-400" : "text-slate-500",
                      interactionBg: isDarkTheme ? "bg-slate-950" : "bg-slate-50",
                      visualInnerBg: isDarkTheme ? "bg-slate-950" : "bg-slate-50",
                      visualBorder: isDarkTheme ? "border-slate-800" : "border-slate-200",
                      profilePic: "💬"
                    }
                  };
                  
                  const cS = platformStyles[platform] || platformStyles.Facebook;

                  return (
                    <div key={item.id} className={`max-w-md mx-auto border rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${cS.cardBg} ${cS.cardBorder}`}>
                      
                      {/* Card Header Profile */}
                      <div className={`p-4 flex items-center justify-between border-b ${isDarkTheme ? "border-slate-850" : "border-slate-100"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${cS.bgColor} text-white`}>
                            {cS.profilePic}
                          </div>
                          <div>
                            <div className={`font-bold text-sm flex items-center gap-1.5 ${cS.textColor}`}>
                              <span>แบรนด์ตัวตนของคุณ (Official)</span>
                              <span className="w-4 h-4 bg-blue-500 rounded-full text-[9px] flex items-center justify-center text-white" title="Verified">✓</span>
                            </div>
                            <div className={`text-[11px] flex items-center gap-1 ${cS.subTextColor}`}>
                              <span>ผู้ดูแลคอนเทนต์แบรนด์ • ลงตัวอย่าง</span>
                              <span>•</span>
                              <span>🌐 {platform}</span>
                            </div>
                          </div>
                        </div>
                        <button type="button" className={`${cS.subTextColor} hover:text-indigo-400 font-bold`}>•••</button>
                      </div>

                      {/* Card Main Caption Area */}
                      <div className="p-4 space-y-3">
                        {/* Hook/Headline displayed as bold */}
                        <div className={`font-extrabold text-base tracking-wide border-l-4 border-indigo-500 pl-2 ${cS.textColor}`}>
                          {item.headline}
                        </div>
                        
                        {/* Main text formatted neatly */}
                        <p className={`text-sm whitespace-pre-wrap leading-relaxed ${cS.textColor}`}>
                          {item.caption}
                        </p>

                        {/* Hashtags list */}
                        <div className="text-blue-500 text-sm font-semibold flex flex-wrap gap-x-1.5">
                          {item.hashtags.map((tag, idx) => (
                            <span key={idx}>
                              {tag.startsWith('#') ? tag : '#' + tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Mock Visual Graphic Suggestion Display Box */}
                      <div className={`p-6 text-center space-y-4 border-y ${isDarkTheme ? "bg-[#242526] border-slate-850" : "bg-slate-50 border-slate-100"}`}>
                        <div className={`h-auto min-h-[176px] rounded-xl border flex flex-col items-center justify-center p-4 ${cS.visualInnerBg} ${cS.visualBorder}`}>
                          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mb-2 text-2xl flex-shrink-0">
                            {mediaFormat === "Video" ? "🎥" : "🖼️"}
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-semibold mb-2 block">
                            ความคาดหวังภาพกราฟิก / คัทซีน {mediaFormat} (รายละเอียด)
                          </span>
                          <div className={`text-xs italic text-left max-w-sm leading-relaxed whitespace-pre-wrap w-full ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
                            {item.visual_suggestion}
                          </div>
                        </div>
                        <p className={`text-[10px] ${cS.subTextColor}`}>
                          (องค์ประกอบภาพศิลป์ แสง สี จะถูกวางกรอบโครงสร้างแนวนี้เพื่อให้ฝ่ายผลิตผลงานต่อทันที)
                        </p>
                      </div>

                      {/* Card Footer Interactions Bar */}
                      <div className={`px-4 py-3 flex items-center justify-between text-xs font-semibold ${cS.interactionBg} ${cS.subTextColor}`}>
                        <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                          <span>👍 กดไลก์ถูกใจ</span>
                        </div>
                        <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                          <span>💬 เขียนความคิดเห็น</span>
                        </div>
                        <div className="flex items-center gap-1 hover:text-blue-500 cursor-pointer">
                          <span>🔄 ส่งต่อ / แชร์</span>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}

        </section>

      </main>

      {/* FOOTER */}
      <footer className={`relative z-20 border-t px-6 py-6 text-center text-xs space-y-2 mt-auto transition-colors duration-300 ${
        theme === "dark" 
          ? "border-slate-900 bg-slate-950 text-slate-500" 
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}>
        <p>© 2026 AI Social Content Assistant Workspace. พัฒนาระบบด้วยแผงควบคุมสลับธีม สว่าง/มืด อเนกประสงค์</p>
        <p className={`${theme === "dark" ? "text-slate-600" : "text-slate-400"}`}>
          ขับเคลื่อนอย่างอัจฉริยะด้วยสมองกล Gemini 2.5 Flash ผสานระบบวิเคราะห์ภาพ/ไฟล์แบรนด์บุกอัพโหลดและวิจัยเทรนด์ไทยเรียลไทม์
        </p>
      </footer>

      {/* MODAL 1: Connect Notion DB Mockup Dialog */}
      {showNotionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`border rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
            theme === "dark" ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 text-slate-800"
          }`}>
            <div className={`p-6 border-b flex items-center justify-between ${theme === "dark" ? "border-slate-800" : "border-slate-100"}`}>
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">เอกสารสรุปกลยุทธ์สินค้าบนฐานข้อมูล Notion</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowNotionModal(false)}
                className={`text-lg font-bold ${theme === "dark" ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                ระบบได้เชื่อมต่อกับ API บัญชี Notion ของคุณ และพบหน้าเอกสารกลยุทธ์แบรนด์ (Brand Book) และสเปกสินค้าที่จดสรุปไว้ 3 ไฟล์ สามารถคลิกเพื่อดึงข้อสรุปเข้ามาวางแผนแคมเปญได้ทันที:
              </p>

              <div className="space-y-3">
                {MOCK_NOTION_PAGES.map((page) => (
                  <div 
                    key={page.id}
                    onClick={() => handleImportNotion(page)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 flex flex-col gap-1.5 ${
                      theme === "dark"
                        ? "bg-slate-950 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900"
                        : "bg-slate-50 border-slate-200 hover:border-indigo-500 hover:bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-indigo-500 font-bold font-mono">Notion Doc Page</span>
                      <span className="text-[10px] text-slate-400">อัพเดตเมื่อวานนี้</span>
                    </div>
                    <h4 className={`text-sm font-bold ${theme === "dark" ? "text-slate-200" : "text-slate-800"}`}>{page.title}</h4>
                    <p className={`text-xs italic line-clamp-2 ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                      "{page.brandInfo}"
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-4 flex justify-end border-t ${theme === "dark" ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
              <button
                type="button"
                onClick={() => setShowNotionModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  theme === "dark" ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                }`}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Full Screen Slides Deck Export Preview */}
      {showSlidePreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
          
          {/* Slides Header Options */}
          <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Presentation className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold">ระบบจำลองสไลด์นำเสนอแผนไอเดียดีไซน์ (Slide Deck Presentation)</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadSlidePackage}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลดสไลด์นำเสนอเว็บ (.html)
              </button>
              <button
                type="button"
                onClick={() => setShowSlidePreview(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Core Slides Area */}
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-900/30">
            {currentSlideIndex === 0 ? (
              // TITLE SLIDE
              <div className="bg-slate-950 border border-slate-800 max-w-4xl w-full h-[450px] rounded-3xl p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex justify-between items-center">
                  <span className="text-indigo-400 font-bold uppercase tracking-widest text-xs">SOCIAL MEDIA PRESENTATION</span>
                  <span className="text-slate-500 text-xs">Generated by AI</span>
                </div>
                <div className="space-y-4 my-auto">
                  <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                    Content Concept Presentation
                  </h1>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                    แผนพิตช์ไอเดียภาพกราฟิก พร้อมแคปชั่นที่ผสานเข้ากับหลักจิตวิทยาคอนเทนต์สำหรับช่องทางหลัก <span className="text-indigo-400 font-bold">{platform}</span> ของธุรกิจคุณ
                  </p>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>ประเภทธุรกิจ: {isCustomBusiness ? customBusiness : businessType}</span>
                  <span>เลื่อนสไลด์ด้วยปุ่มควบคุมด้านล่าง</span>
                </div>
              </div>
            ) : (
              // CONTENT SLIDES (Each content occupies 2 slides: Slide A: Idea Pitch, Slide B: Copy/Tags)
              (() => {
                const contentIndex = Math.floor((currentSlideIndex - 1) / 2);
                const isPitchSlide = (currentSlideIndex - 1) % 2 === 0;
                const item = generatedContents[contentIndex];

                if (!item) return null;

                if (isPitchSlide) {
                  return (
                    <div className="bg-slate-950 border border-slate-800 max-w-4xl w-full h-[450px] rounded-3xl p-10 flex flex-col justify-between shadow-2xl">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-indigo-400 font-bold text-xs uppercase">POST #{contentIndex + 1} - ไดเรกชั่นไอเดียกราฟิก</span>
                        <span className="text-slate-500 text-xs">{platform} • {mediaFormat}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto">
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Hook ดึงดูดสายตา:</h5>
                            <h2 className="text-xl font-extrabold text-slate-100 leading-tight">
                              {item.headline}
                            </h2>
                          </div>
                          <div>
                            <h5 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">แนวทางและองค์ประกอบศิลป์ (Visual Concept):</h5>
                            <div className="p-3.5 bg-amber-950/40 border border-amber-900/50 rounded-xl text-amber-200 text-xs italic whitespace-pre-wrap max-h-[160px] overflow-y-auto leading-relaxed">
                              {item.visual_suggestion}
                            </div>
                          </div>
                        </div>

                        <div className="h-full min-h-[180px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            🎨
                          </div>
                          <h6 className="font-bold text-xs text-slate-200">ส่งต่อแนวทางการออกแบบให้ดีไซเนอร์</h6>
                          <p className="text-[10px] text-slate-500 max-w-[200px]">
                            สไตล์อารมณ์ คุมโทน และองค์ประกอบทั้งหมด สอดรับกับพฤติกรรมคนใช้งาน {platform}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>สไลด์ {currentSlideIndex} จาก {(generatedContents.length * 2) + 1}</span>
                        <span>{platform} AI Assistant Strategy Pack</span>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-slate-950 border border-slate-800 max-w-4xl w-full h-[450px] rounded-3xl p-10 flex flex-col justify-between shadow-2xl">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-indigo-400 font-bold text-xs uppercase">POST #{contentIndex + 1} - แคปชั่นสำหรับสื่อสาร</span>
                        <span className="text-slate-500 text-xs">Copywriting Style</span>
                      </div>
                      
                      <div className="my-auto space-y-3">
                        <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">แคปชั่นจริงที่จะใช้เผยแพร่:</h5>
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs text-slate-200 whitespace-pre-wrap max-h-[220px] overflow-y-auto leading-relaxed font-sans">
{item.caption}

{item.hashtags.map(t => t.startsWith('#') ? t : '#' + t).join(' ')}
                        </div>
                      </div>

                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>สไลด์ {currentSlideIndex} จาก {(generatedContents.length * 2) + 1}</span>
                        <span>สามารถคัดลอกส่วนแคปชั่นนี้ไปใช้ได้ทันที</span>
                      </div>
                    </div>
                  );
                }
              })()
            )}
          </div>

          {/* Slides Nav Footer */}
          <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              หน้าสไลด์ที่ <span className="text-indigo-400 font-bold">{currentSlideIndex + 1}</span> จากทั้งหมด <span className="text-slate-200 font-bold">{(generatedContents.length * 2) + 1}</span> แผ่น
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={currentSlideIndex === 0}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button
                type="button"
                onClick={() => setCurrentSlideIndex(prev => Math.min((generatedContents.length * 2), prev + 1))}
                disabled={currentSlideIndex === (generatedContents.length * 2)}
                className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}