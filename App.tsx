
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AIRCRAFT_CONFIGS } from './constants.ts';
import { WatermarkedPhoto, AircraftDoor, AircraftConfig } from './types.ts';
import { applyWatermarkToImage, generateThumbnail } from './services/watermarkService.ts';
import { Logger } from './services/loggerService.ts';

// ------------------- CONSTANTS & TYPES -------------------

const APP_VERSION = "V1.4.7"; // Gallery UI Polish

// CHANGELOG: Dates are hardcoded to ensure consistency regardless of system time
// NOTE: When releasing a NEW version, manually add a new entry at the top with the CURRENT date.
const CHANGELOG = [
  { version: "V1.4.7", date: "2025-12-24", content: "UI 优化：相册管理模式下，左上角按钮改为「取消」，操作更符合直觉。\nUI 优化：管理模式底部按钮增加文字标签（分享、保存、删除），并更换了更直观的保存图标。" },
  { version: "V1.4.6", date: "2025-12-24", content: "新功能：相册管理模式新增「分享」和「保存」按钮，支持多张照片原图批量分享（不拼长图）或批量保存。\n新功能：大图预览界面新增「分享」和「保存」按钮，方便单张快速操作。" },
  { version: "V1.4.5", date: "2025-12-23", content: "UI 调整：应用户要求，在首页底部恢复显示版权信息（© 802711）。" },
  { version: "V1.4.4", date: "2025-12-23", content: "UI 调整：移除首页底部版权文字；调整相册界面底部按钮布局，现在“相册”与“拍摄”按钮等宽显示。" },
  { version: "V1.4.3", date: "2025-12-23", content: "文档更新：使用说明新增「故障排除」章节，详细说明了软件异常时的处理方案及清空缓存的风险提示。" },
  { version: "V1.4.2", date: "2025-12-23", content: "UI 优化：首页机型图标和文字显著放大，提升点击体验和视觉清晰度。\n交互新增：点击首页版本号现可直接查看更新日志。\n调整：移除通用检查模块，保持界面简洁专注于机型检查。" },
  { version: "V1.4.1", date: "2025-12-22", content: "修复：解决安卓手机拍照后因内存回收导致APP重启、跳回轮廓图的问题。现在系统会自动记住您操作的舱门位置。\n优化：进一步压缩列表预览图，极大提升50张以上图片时的流畅度。\n新增：拍照保存后会有明确的“已保存”提示。" },
  { version: "V1.4.0", date: "2025-12-21", content: "性能重构：引入缩略图机制，大幅降低内存占用，修复多图卡顿崩溃问题。\n新功能：全新导出结果页面，支持预览、保存和分享。\n优化：导出算法改为串行处理，彻底解决多图导出失败的问题。" },
  { version: "V1.3.11", date: "2025-12-20", content: "文档重构：使用说明全面升级为图文详解版，移除简易模式；重点提示操作细节。\nUI 优化：首页副标题增加 ETA/ETD 标识。" },
  { version: "V1.3.10", date: "2025-12-19", content: "UI 优化：首页标题升级为「CABIN AUTO-MARK」，优化移动端单行排版，提升视觉商业质感。" },
  { version: "V1.3.9", date: "2025-12-18", content: "优化：设置界面移除「当前版本」显示，通过更新日志即可查看；文档：补全项目从 V0.0.1 至今的所有历史更新记录。" },
  { version: "V1.3.8", date: "2025-12-18", content: "修复：在预览大图界面删除照片后，现在会自动返回缩略图列表，操作更流畅。" },
  { version: "V1.3.7", date: "2025-12-17", content: "UI 优化：首页机型角标增加呼吸动效，提示更醒目；新增：项目根目录添加 Dockerfile 和 compose.yaml，支持 NAS 快速部署。" },
  { version: "V1.3.6", date: "2025-12-17", content: "UI 优化：显著增强首页机型卡片上的数据角标提示，采用高亮红色通知风格，状态一目了然。" },
  { version: "V1.3.5", date: "2025-12-16", content: "紧急修复：修复飞机信息登记界面点击「保存」无反应的问题；修复从弹窗返回后APP界面无法点击、手势失效的严重Bug。" },
];

// Added 'EXITED' and 'EXPORT_RESULT' state
type ViewState = 'HOME' | 'AIRCRAFT_MAP' | 'GALLERY' | 'FULLSCREEN' | 'PREVIEW' | 'SETTINGS' | 'EXITED' | 'EXPORT_RESULT';
type InspectionType = '进场照片' | '出场照片' | null;
type SettingsView = 'MAIN' | 'CHANGELOG' | 'LOGS' | 'GUIDE';

interface AircraftMetadata {
  regNumber: string;
  inspectionType: InspectionType;
}

// ------------------- INDEXED DB HELPERS -------------------
const DB_NAME = 'CabinAutoMarkDB';
const DB_VERSION = 1;
const PHOTO_STORE = 'photos';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Optimized: Returns lightweight objects (thumbnails) for the UI list
const getAllPhotosFromDB = async (): Promise<WatermarkedPhoto[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE, 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.openCursor();
      const results: WatermarkedPhoto[] = [];

      request.onsuccess = async (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const photo = cursor.value as WatermarkedPhoto;
          
          let thumbnailToUse = photo.thumbnail;

          // MIGRATION: If thumbnail is missing, generate it now
          if (!thumbnailToUse && photo.src) {
             try {
                // Generate on the fly
                thumbnailToUse = await generateThumbnail(photo.src);
                // Update DB so we don't do this next time
                photo.thumbnail = thumbnailToUse;
                cursor.update(photo);
             } catch (e) {
                console.warn("Failed to migrate thumb for", photo.id);
             }
          }

          // STRICT MEMORY POLICY:
          // Never push 'photo.src' (the high res base64) to the list state.
          // If no thumbnail exists (error case), push an empty string or placeholder.
          results.push({
            ...photo,
            src: "", // STRIP DATA TO SAVE RAM
            thumbnail: thumbnailToUse || "" // Fallback to empty string, NOT full src
          });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    Logger.error("DB_LOAD_FAIL", e);
    console.warn("DB Error", e);
    return [];
  }
};

const getPhotoById = async (id: string): Promise<WatermarkedPhoto | undefined> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE, 'readonly');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    return undefined;
  }
};

const savePhotoToDB = async (photo: WatermarkedPhoto) => {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE, 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      const request = store.put(photo);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    Logger.error("DB_SAVE_FAIL", e);
    console.error("Save to DB failed", e);
  }
};

const deletePhotosFromDB = async (ids: string[]) => {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(PHOTO_STORE, 'readwrite');
      const store = transaction.objectStore(PHOTO_STORE);
      let count = 0;
      if (ids.length === 0) {
        resolve();
        return;
      }
      ids.forEach(id => {
        const request = store.delete(id);
        request.onsuccess = () => {
          count++;
          if (count === ids.length) resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (e) {
    Logger.error("DB_DELETE_FAIL", e);
    console.error("Delete from DB failed", e);
  }
};

const getSystemDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ------------------- MAIN COMPONENT -------------------

export const App: React.FC = () => {
  // State
  const [view, setView] = useState<ViewState>('HOME');
  
  const [selectedAircraftId, setSelectedAircraftId] = useState<string>('A320');
  const [photos, setPhotos] = useState<WatermarkedPhoto[]>([]); // These are now "Lite" photos
  const [activeDoor, setActiveDoor] = useState<AircraftDoor | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState("正在处理...");

  const [activePhoto, setActivePhoto] = useState<WatermarkedPhoto | null>(null);
  const [activePhotoFullSrc, setActivePhotoFullSrc] = useState<string | null>(null); // For Fullscreen

  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [metadataMap, setMetadataMap] = useState<Record<string, AircraftMetadata>>({});

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('MAIN');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearAircraftConfirm, setShowClearAircraftConfirm] = useState(false);
  const [showExportWarning, setShowExportWarning] = useState(false);
  
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [exportResultUrl, setExportResultUrl] = useState<string | null>(null); // New state for export result

  const [tempRegNumber, setTempRegNumber] = useState('');
  const [tempInspectionType, setTempInspectionType] = useState<InspectionType>(null);
  
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const stateRef = useRef({ 
    activeDoor, activePhoto, tempPhoto, view, showExitConfirm,
    showInfoModal 
  });

  useEffect(() => {
    stateRef.current = { 
      activeDoor, activePhoto, tempPhoto, view, showExitConfirm,
      showInfoModal
    };
  }, [activeDoor, activePhoto, tempPhoto, view, showExitConfirm, showInfoModal]);

  const currentAircraft = AIRCRAFT_CONFIGS[selectedAircraftId];
  
  const currentMetadata = useMemo(() => {
    return metadataMap[selectedAircraftId] || { regNumber: '', inspectionType: null };
  }, [metadataMap, selectedAircraftId]);

  const regNumber = currentMetadata.regNumber;
  const inspectionType = currentMetadata.inspectionType;

  // --- INITIALIZATION & PERSISTENCE ---

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingText("加载中...");
        setIsProcessing(true);
        // This will now migrate thumbnails if needed and return lite objects
        const loadedPhotos = await getAllPhotosFromDB();
        setPhotos(loadedPhotos);
        Logger.info("APP_INIT", `Loaded ${loadedPhotos.length} photos`);
        
        // --- SESSION RESTORATION (Fix for Android Camera Refresh) ---
        try {
          const savedAircraftId = sessionStorage.getItem('selectedAircraftId');
          const savedDoorId = sessionStorage.getItem('activeDoorId');
          const savedView = sessionStorage.getItem('currentView') as ViewState;
          
          if (savedAircraftId) {
            setSelectedAircraftId(savedAircraftId);
            
            if (savedDoorId) {
              const door = AIRCRAFT_CONFIGS[savedAircraftId]?.doors.find((d: AircraftDoor) => d.id === savedDoorId);
              if (door) {
                setActiveDoor(door);
                if (savedView === 'GALLERY') {
                   // Force gallery view if we were there
                   setView('GALLERY');
                   window.history.pushState({ view: 'GALLERY', appInitialized: true }, '');
                }
              }
            }
          }
        } catch (e) {
          console.warn("Session restore failed", e);
        }

      } catch (e) {
        Logger.error("APP_INIT_ERROR", e);
      } finally {
        setIsProcessing(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    try {
      const savedMeta = localStorage.getItem('aircraftMetadata');
      if (savedMeta) {
        setMetadataMap(JSON.parse(savedMeta));
      }
    } catch (e) {
      Logger.error("META_LOAD_ERROR", e);
    }
  }, []);

  // Persist Metadata
  useEffect(() => {
    localStorage.setItem('aircraftMetadata', JSON.stringify(metadataMap));
  }, [metadataMap]);

  // Persist Session State (For Camera Return)
  useEffect(() => {
    sessionStorage.setItem('selectedAircraftId', selectedAircraftId);
    if (activeDoor) {
      sessionStorage.setItem('activeDoorId', activeDoor.id);
    } else {
      sessionStorage.removeItem('activeDoorId');
    }
    sessionStorage.setItem('currentView', view);
  }, [selectedAircraftId, activeDoor, view]);

  // Load Full Res photo when activePhoto changes (for Fullscreen)
  useEffect(() => {
    const loadFullRes = async () => {
      if (activePhoto && view === 'FULLSCREEN') {
         // If src is missing (it's a lite object), fetch from DB
         if (!activePhoto.src || activePhoto.src === "") {
             const fullRecord = await getPhotoById(activePhoto.id);
             if (fullRecord && fullRecord.src) {
                 setActivePhotoFullSrc(fullRecord.src);
             } else {
                 setActivePhotoFullSrc(activePhoto.thumbnail || null); // Fallback
             }
         } else {
             setActivePhotoFullSrc(activePhoto.src);
         }
      } else {
          setActivePhotoFullSrc(null);
      }
    };
    loadFullRes();
  }, [activePhoto, view]);

  const vibrateShort = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }
  };

  // --- ROBUST NAVIGATION & EXIT SYSTEM ---
  
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const isInitialized = window.history.state && window.history.state.appInitialized;
    if (!isInitialized) {
      window.history.replaceState({ view: 'ROOT_EXIT', appInitialized: true }, '');
      window.history.pushState({ view: 'HOME', appInitialized: true }, '');
    }
    
    // Only set Home if not restored by Session logic in init
    if (view === 'HOME' && !sessionStorage.getItem('currentView')) {
       setView('HOME');
    }

    const handlePopState = (event: PopStateEvent) => {
      const currentState = stateRef.current; 
      const targetState = event.state;

      if (currentState.view === 'EXITED') {
         window.history.pushState({ view: 'EXITED', appInitialized: true }, '');
         return;
      }

      if (currentState.showInfoModal) {
        setShowInfoModal(false);
        if (!targetState || targetState.view === 'ROOT_EXIT') {
           const returnView = currentState.view === 'AIRCRAFT_MAP' ? 'AIRCRAFT_MAP' : 'HOME';
           window.history.pushState({ view: returnView, appInitialized: true }, '');
        }
        return;
      }

      if (currentState.showExitConfirm) {
        setShowExitConfirm(false);
        window.history.pushState({ view: 'HOME', appInitialized: true }, '');
        return;
      }

      if (!targetState || targetState.view === 'ROOT_EXIT') {
        window.history.pushState({ view: 'HOME', appInitialized: true }, '');
        setShowExitConfirm(true);
        return;
      }

      let nextView: ViewState = targetState.view || 'HOME';

      // Logic to prevent "Falling out" to map if we were in gallery but lost door state
      if (nextView === 'GALLERY' && !currentState.activeDoor) {
         // Attempt recovery from session if needed, otherwise fallback
         nextView = 'AIRCRAFT_MAP';
      } 
      else if (nextView === 'FULLSCREEN' && (!currentState.activePhoto || !currentState.activeDoor)) {
         nextView = currentState.activeDoor ? 'GALLERY' : 'AIRCRAFT_MAP';
      }
      else if (nextView === 'PREVIEW' && !currentState.tempPhoto) {
         nextView = currentState.activeDoor ? 'GALLERY' : 'AIRCRAFT_MAP';
      }
      else if (nextView === 'EXPORT_RESULT' && !exportResultUrl) {
         nextView = 'AIRCRAFT_MAP';
      }
      
      if (currentState.view === 'SETTINGS' && nextView !== 'SETTINGS') {
          setTimeout(() => setSettingsView('MAIN'), 100);
      }

      setView(nextView);
      if (nextView !== targetState.view) {
          window.history.replaceState({ view: nextView, appInitialized: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushView = (newView: ViewState) => {
    setView(newView);
    window.history.pushState({ view: newView, appInitialized: true }, '');
  };

  const goBack = () => {
    window.history.back();
  };

  // --- VIEW SPECIFIC EFFECTS ---

  useEffect(() => {
    if (view === 'AIRCRAFT_MAP' || view === 'HOME') {
      setIsManageMode(false);
      setSelectedPhotoIds(new Set());
      setReplacingPhotoId(null);
      setTempPhoto(null);
      setShowDeleteConfirm(false);
      setShowExportWarning(false);
      setSettingsView('MAIN');
      setShowClearAircraftConfirm(false);
      setShowExitConfirm(false); 
      setShowClearLogsConfirm(false); 
      if (exportResultUrl) {
          // Cleanup blob when leaving export flow
          URL.revokeObjectURL(exportResultUrl);
          setExportResultUrl(null);
      }
    }
  }, [view, selectedAircraftId]);

  // --- LOGIC ---

  const doorPhotos = useMemo(() => {
    if (!activeDoor) return [];
    return photos.filter(p => p.doorId === activeDoor.id && p.aircraftType === selectedAircraftId);
  }, [photos, activeDoor, selectedAircraftId]);

  const triggerCamera = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReplacingPhotoId(null); 
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const triggerGallery = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReplacingPhotoId(null); 
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  const handleDoorClick = (door: AircraftDoor) => {
    setActiveDoor(door);
    pushView('GALLERY');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeDoor) {
      setLoadingText("正在添加水印...");
      setIsProcessing(true);
      
      // Ensure we stay on gallery or go to preview
      if (!replacingPhotoId) {
         // Force view to Gallery if adding new, just in case state drifted
         if (view !== 'GALLERY') setView('GALLERY');
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string;
        try {
          // 1. Generate Full Res Watermarked Image
          const watermarkedFull = await applyWatermarkToImage(base64, activeDoor.watermark, { showTimestamp: false });
          
          if (replacingPhotoId) {
            setTempPhoto(watermarkedFull);
            pushView('PREVIEW');
          } else {
            // 2. Generate Thumbnail for UI
            const thumbnail = await generateThumbnail(watermarkedFull);

            const newPhotoFull: WatermarkedPhoto = {
              id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              doorId: activeDoor.id,
              aircraftType: selectedAircraftId,
              src: watermarkedFull,
              thumbnail: thumbnail,
              timestamp: new Date().toISOString()
            };

            // 3. Save FULL object to DB
            await savePhotoToDB(newPhotoFull);

            // 4. Set LITE object to State (src is empty to save RAM)
            const newPhotoLite = { ...newPhotoFull, src: "" };
            setPhotos(prev => [...prev, newPhotoLite]);
            
            Logger.success("PHOTO_ADD", `Added photo for ${activeDoor.id}`);
            
            // FEEDBACK
            setToastMessage("✅ 照片已保存");
            setTimeout(() => setToastMessage(null), 2000);
            
            // Ensure we are definitely in Gallery
            if (view !== 'GALLERY') {
                pushView('GALLERY');
            }
          }
        } catch (err) {
          Logger.error("WATERMARK_FAIL", err);
          alert("水印生成失败，请重试");
        } finally {
          setIsProcessing(false);
          // Clear input so same file can be selected again if needed
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          if (galleryInputRef.current) galleryInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        setIsProcessing(false);
        Logger.error("FILE_READ_ERROR", "FileReader onError triggered");
        alert("文件读取失败");
      };
      reader.readAsDataURL(file);
    }
  };

  const saveReplacement = async () => {
    if (tempPhoto && replacingPhotoId) {
      // Find the LITE object in state to get details
      const targetPhotoLite = photos.find(p => p.id === replacingPhotoId);
      if (targetPhotoLite) {
        // Generate new thumbnail
        const thumbnail = await generateThumbnail(tempPhoto);

        const updatedPhotoFull = { 
          ...targetPhotoLite, 
          src: tempPhoto, 
          thumbnail: thumbnail,
          timestamp: new Date().toISOString() 
        };

        // Save Full to DB
        await savePhotoToDB(updatedPhotoFull);

        // Update State with Lite version
        const updatedPhotoLite = { ...updatedPhotoFull, src: "" };
        setPhotos(prev => prev.map(p => p.id === replacingPhotoId ? updatedPhotoLite : p));
        
        Logger.success("PHOTO_REPLACE", `Replaced photo ${replacingPhotoId}`);
        setToastMessage("✅ 照片已替换");
        setTimeout(() => setToastMessage(null), 2000);
      }
      
      setTempPhoto(null);
      setReplacingPhotoId(null);
      
      if (activeDoor && window.history.length > 2) {
         window.history.go(-2);
      } else {
         setView('GALLERY');
         window.history.replaceState({ view: 'GALLERY', appInitialized: true }, '');
      }
    }
  };

  const handleRetakeInPreview = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const startRetakeFlowFromFull = (photo: WatermarkedPhoto) => {
    setReplacingPhotoId(photo.id);
    handleRetakeInPreview();
  };

  const togglePhotoSelection = (id: string) => {
    vibrateShort();
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBatchDelete = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (selectedPhotoIds.size > 0) {
      vibrateShort();
      setShowDeleteConfirm(true);
    }
  };

  const executeBatchDelete = async () => {
    const idsToDelete = Array.from(selectedPhotoIds) as string[];
    await deletePhotosFromDB(idsToDelete);
    setPhotos(prevPhotos => prevPhotos.filter(photo => !idsToDelete.includes(photo.id)));
    Logger.info("BATCH_DELETE", `Deleted ${idsToDelete.length} photos`);
    
    setSelectedPhotoIds(new Set());
    setIsManageMode(false);
    setShowDeleteConfirm(false);

    if (view === 'FULLSCREEN') {
      goBack();
    }
  };

  // --- UNIVERSAL SHARE & SAVE LOGIC (SINGLE & BATCH) ---

  const handleUniversalShare = async (photoIds: string[]) => {
    if (photoIds.length === 0) return;
    
    setIsProcessing(true);
    setLoadingText(photoIds.length === 1 ? "正在准备分享..." : "正在打包照片...");

    try {
      const files: File[] = [];
      
      for (const id of photoIds) {
        const photo = await getPhotoById(id);
        if (photo && photo.src) {
          const response = await fetch(photo.src);
          const blob = await response.blob();
          const filename = `${regNumber || 'IMG'}_${photo.doorId}_${photo.timestamp.slice(-5)}.jpg`.replace(/[:.]/g, '');
          files.push(new File([blob], filename + ".jpg", { type: 'image/jpeg' }));
        }
      }

      if (files.length === 0) {
        throw new Error("No files found");
      }

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          files: files,
          title: 'CABIN AUTO MARK',
          text: `分享 ${files.length} 张照片`
        });
        Logger.success("SHARE_SUCCESS", `Shared ${files.length} photos`);
      } else {
        setToastMessage("当前浏览器不支持直接分享");
        setTimeout(() => setToastMessage(null), 2000);
      }
    } catch (e) {
      console.error("Share failed", e);
      setToastMessage("分享失败");
      setTimeout(() => setToastMessage(null), 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUniversalSave = async (photoIds: string[]) => {
    if (photoIds.length === 0) return;

    setIsProcessing(true);
    setLoadingText("正在保存...");
    setToastMessage("开始保存到相册...");

    try {
      // Loop with slight delay to prevent browser throttling downloads
      for (let i = 0; i < photoIds.length; i++) {
        const id = photoIds[i];
        const photo = await getPhotoById(id);
        
        if (photo && photo.src) {
           const link = document.createElement('a');
           link.href = photo.src;
           const filename = `${regNumber || 'IMG'}_${photo.doorId}_${photo.timestamp.slice(-8)}.jpg`.replace(/[:]/g, '');
           link.download = filename;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
           
           // Small delay between downloads if batch
           if (photoIds.length > 1) {
             await new Promise(r => setTimeout(r, 300));
           }
        }
      }
      
      setTimeout(() => setToastMessage("保存完成"), 500);
      setTimeout(() => setToastMessage(null), 2500);
      
      if (isManageMode) {
         setIsManageMode(false);
         setSelectedPhotoIds(new Set());
      }

    } catch (e) {
      console.error("Save failed", e);
      setToastMessage("保存失败");
      setTimeout(() => setToastMessage(null), 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAircraftPhotos = () => {
    vibrateShort();
    setShowClearAircraftConfirm(true);
  };

  const executeClearAircraftPhotos = async () => {
    const photosToDelete = photos.filter(p => p.aircraftType === selectedAircraftId);
    const idsToDelete = photosToDelete.map(p => p.id);
    
    await deletePhotosFromDB(idsToDelete);
    setPhotos(prev => prev.filter(p => p.aircraftType !== selectedAircraftId));
    
    setMetadataMap(prev => {
      const next = { ...prev };
      delete next[selectedAircraftId];
      return next;
    });

    Logger.warn("CLEAR_AIRCRAFT", `Cleared all data for ${selectedAircraftId}`);
    setShowClearAircraftConfirm(false);
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!regNumber || !inspectionType) {
        setShowExportWarning(true);
        return;
    }

    const exportPhotosLite = photos.filter(p => p.aircraftType === selectedAircraftId);
    if (exportPhotosLite.length === 0) {
        alert("没有可导出的照片，请先拍摄或添加照片。");
        return;
    }
    
    // Sort logic
    const sortedPhotos = [...exportPhotosLite].sort((a, b) => {
      const doorA = currentAircraft.doors.find(d => d.id === a.doorId);
      const doorB = currentAircraft.doors.find(d => d.id === b.doorId);
      if (!doorA || !doorB) return 0;
      if (Math.abs(doorA.y - doorB.y) > 2) return doorA.y - doorB.y;
      return doorA.x - doorB.x;
    });

    setLoadingText("正在准备导出...");
    setIsProcessing(true);

    // Use setTimeout to allow UI render
    setTimeout(async () => {
        try {
          // --- SEQUENTIAL PROCESSING TO PREVENT MEMORY CRASH ---
          
          const CANVAS_WIDTH = 1600; 
          const PADDING = 40;
          const HEADER_HEIGHT = 200; 
          const GAP = 40;
          const TEXT_HEIGHT = 60;
          const FOOTER_HEIGHT = 100;

          // 1. Calculate Layout Dimensions using LITE objects (Thumbnails/meta)
          // We need aspect ratios. Thumbnails should have approx same aspect ratio as full.
          // To be safe, we might need to load just metadata, but for now we assume loading
          // image objects sequentially is fine.
          
          const layoutData: { photo: WatermarkedPhoto, h: number, y: number, img: HTMLImageElement | null }[] = [];
          let currentY = HEADER_HEIGHT;

          // We will create a temporary canvas to measure or just load image, measure, then nullify
          
          for (let i = 0; i < sortedPhotos.length; i++) {
             const photo = sortedPhotos[i];
             setLoadingText(`正在加载照片 (${i + 1}/${sortedPhotos.length})...`);
             
             // Fetch FULL RES from DB
             const fullRecord = await getPhotoById(photo.id);
             if (!fullRecord || !fullRecord.src) continue;

             // Create Image element to get dimensions
             await new Promise<void>((resolve, reject) => {
                 const img = new Image();
                 img.onload = () => {
                     const scale = (CANVAS_WIDTH - PADDING * 2) / img.width;
                     const h = img.height * scale;
                     
                     // Store layout info, BUT DO NOT STORE IMG OBJECT YET to save RAM
                     layoutData.push({
                         photo: fullRecord, // Contains src
                         h: h,
                         y: currentY,
                         img: img // We keep it for the next step, but if we have too many, we might need to reload. 
                                  // Actually, keeping 50 Image objects in RAM might still be heavy. 
                                  // Optimized strategy: Load, Draw, Discard immediately.
                     });
                     currentY += h + TEXT_HEIGHT + GAP;
                     resolve();
                 };
                 img.onerror = () => resolve(); // Skip on error
                 img.src = fullRecord.src;
             });
          }

          const totalHeight = currentY + FOOTER_HEIGHT;

          // 2. Setup Canvas
          const canvas = document.createElement('canvas');
          canvas.width = CANVAS_WIDTH;
          canvas.height = totalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Canvas init failed");

          // 3. Draw Background & Header
          setLoadingText("正在绘制...");
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const typeLabel = inspectionType ? inspectionType.replace('照片', '') : '';
          const mainTitle = `${regNumber || selectedAircraftId} ${typeLabel}图片`;
          
          // Draw Header Text
          ctx.fillStyle = '#0f172a';
          ctx.font = '800 80px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", -apple-system, sans-serif'; 
          ctx.textAlign = 'left';
          ctx.shadowColor = "rgba(0,0,0,0.1)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 4;
          ctx.fillText(mainTitle, PADDING, 110);
          
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          ctx.textAlign = 'right';
          ctx.textBaseline = 'alphabetic';
          ctx.font = '500 32px "PingFang SC", -apple-system, sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.fillText(`Produced By Cloud Rui Peng | © 802711`, CANVAS_WIDTH - PADDING, 110);

          ctx.strokeStyle = '#f1f5f9';
          ctx.lineWidth = 4;
          ctx.beginPath(); 
          ctx.moveTo(PADDING, 160); 
          ctx.lineTo(CANVAS_WIDTH - PADDING, 160); 
          ctx.stroke();

          // 4. Sequential Draw Loop
          for (let i = 0; i < layoutData.length; i++) {
             setLoadingText(`正在合成 (${i + 1}/${layoutData.length})...`);
             const item = layoutData[i];
             
             if (item.img) {
                 ctx.drawImage(item.img, PADDING, item.y, CANVAS_WIDTH - PADDING * 2, item.h);
                 
                 // Draw Label
                 const doorLabel = currentAircraft.doors.find(d => d.id === item.photo.doorId)?.label || item.photo.doorId;
                 ctx.fillStyle = '#334155';
                 ctx.font = '600 40px "PingFang SC", -apple-system, sans-serif';
                 ctx.textAlign = 'left';
                 ctx.fillText(doorLabel, PADDING, item.y + item.h + 50);

                 // Draw Separator
                 if (i < layoutData.length - 1) {
                   const lineY = item.y + item.h + 90;
                   ctx.beginPath();
                   ctx.moveTo(PADDING, lineY);
                   ctx.lineTo(CANVAS_WIDTH - PADDING, lineY);
                   ctx.strokeStyle = '#e2e8f0'; 
                   ctx.lineWidth = 2;
                   ctx.stroke();
                 }

                 // CRITICAL: Free memory
                 item.img.src = "";
                 item.img = null;
                 item.photo.src = ""; // Clear source string from memory
             }
             
             // Small pause to let GC breathe
             if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
          }

          // 5. Draw Footer
          const footerColor = '#cbd5e1';
          const footerY = totalHeight - 40;
          const footerFontSize = 26;
          const fontStandard = `${footerFontSize}px -apple-system, sans-serif`;
          const fontBrand = `${footerFontSize}px "LiSu", "STLiti", "SimLi", "KaiTi", "STKaiti", "BiauKai", "Georgia", serif`;
          
          const part1 = "CABIN AUTO MARK SYSTEM | ";
          const brandText = "云瑞鹏";
          const part2 = ` | © 802711 | 导出时间: ${new Date().toLocaleString()}`;

          ctx.font = fontStandard;
          const w1 = ctx.measureText(part1).width;
          const w2 = ctx.measureText(part2).width;

          ctx.font = fontBrand;
          const wBrandText = ctx.measureText(brandText).width;
          const ovalPaddingX = 12; 
          const wBrandTotal = wBrandText + (ovalPaddingX * 2);

          const totalFooterWidth = w1 + wBrandTotal + w2;
          let currentX = (CANVAS_WIDTH - totalFooterWidth) / 2;

          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = fontStandard;
          ctx.fillStyle = footerColor;
          ctx.fillText(part1, currentX, footerY);
          currentX += w1;

          const brandCenterX = currentX + (wBrandTotal / 2);
          ctx.strokeStyle = footerColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const ovalRadiusX = (wBrandText / 2) + 8;
          const ovalRadiusY = (footerFontSize / 2) + 6;
          ctx.ellipse(brandCenterX, footerY, ovalRadiusX, ovalRadiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();

          ctx.font = fontBrand;
          ctx.textAlign = 'center';
          ctx.fillText(brandText, brandCenterX, footerY + 2);

          currentX += wBrandTotal;

          ctx.textAlign = 'left';
          ctx.font = fontStandard;
          ctx.fillText(part2, currentX, footerY);

          // 6. Finalize
          canvas.toBlob((blob) => {
            if (!blob) { alert("生成失败"); setIsProcessing(false); return; }
            const url = URL.createObjectURL(blob);
            
            // Set Result State and Switch View
            setExportResultUrl(url);
            pushView('EXPORT_RESULT');
            
            setIsProcessing(false);
            Logger.success("EXPORT_SUCCESS", `Exported ${exportPhotosLite.length} photos for ${selectedAircraftId}`);
          }, 'image/jpeg', 0.85); // Slightly lower quality for huge files
        } catch (err) {
          Logger.error("EXPORT_ERROR", err);
          alert("导出失败，请尝试减少照片数量或重启应用");
          setIsProcessing(false);
        }
    }, 100);
  };

  const handleShare = async () => {
    if (!exportResultUrl) return;
    try {
        const response = await fetch(exportResultUrl);
        const blob = await response.blob();
        const file = new File([blob], "export.jpg", { type: "image/jpeg" });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'CABIN AUTO MARK 导出',
                text: '进出场检查照片'
            });
        } else {
            setToastMessage("当前浏览器不支持直接分享");
            setTimeout(() => setToastMessage(null), 2000);
        }
    } catch (e) {
        console.error("Share failed", e);
        setToastMessage("分享失败");
        setTimeout(() => setToastMessage(null), 2000);
    }
  };

  const handleDownload = () => {
    if (!exportResultUrl) return;
    const link = document.createElement('a');
    link.href = exportResultUrl;
    const typeLabel = inspectionType ? inspectionType.replace('照片', '') : 'Export';
    const dateStr = getSystemDate().replace(/-/g, '');
    link.download = `${regNumber || 'AIRCRAFT'}_${typeLabel}_${dateStr}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage("已开始下载");
    setTimeout(() => setToastMessage(null), 2000);
  };

  // ... (Previous Helper Functions: handleExitApp, cancelExit, etc. keep same) ...
  const handleExitApp = () => {
      Logger.info("APP_EXIT", "User confirmed exit");
      try { window.close(); } catch(e) {}
      setTimeout(() => {
        setShowExitConfirm(false);
        setView('EXITED');
        window.history.pushState({ view: 'EXITED', appInitialized: true }, '');
      }, 100);
  };
  const cancelExit = () => setShowExitConfirm(false);
  const handleCopyLogs = async () => {
    try {
      const logs = Logger.getLogs();
      await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
      setToastMessage("日志已复制");
      setTimeout(() => setToastMessage(null), 2000);
    } catch (err) { setToastMessage("复制失败"); setTimeout(() => setToastMessage(null), 2000); }
  };
  const executeClearLogs = () => {
    Logger.clear();
    setSettingsView('LOGS');
    setShowClearLogsConfirm(false);
    setToastMessage("日志已清空");
    setTimeout(() => setToastMessage(null), 2000);
  };
  
  // MODAL HANDLERS (Same as before)
  const openSettings = () => pushView('SETTINGS');
  const handleSettingsBack = () => settingsView !== 'MAIN' ? setSettingsView('MAIN') : goBack();
  const openInfo = () => {
    setTempRegNumber(regNumber);
    setTempInspectionType(inspectionType);
    setShowInfoModal(true);
    window.history.pushState({ view: view, appInitialized: true, modal: 'INFO' }, '');
  };
  const closeInfo = () => window.history.state?.modal === 'INFO' ? window.history.back() : setShowInfoModal(false);
  const handleSaveInfo = () => {
    vibrateShort();
    setMetadataMap(prev => ({ ...prev, [selectedAircraftId]: { regNumber: tempRegNumber, inspectionType: tempInspectionType } }));
    closeInfo();
  };

  // --- RENDERERS ---
  
  // New: Export Result Screen
  const renderExportResult = () => (
    <div className="h-full w-full bg-slate-900 flex flex-col z-[100] animate-in fade-in slide-in-from-bottom duration-300">
       <div className="h-16 flex items-center justify-between px-4 shrink-0 bg-slate-800 text-white">
          <button onClick={goBack} className="text-[17px] font-medium text-slate-300 flex items-center gap-1 active:opacity-60">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
             返回
          </button>
          <span className="font-bold text-[17px]">导出完成</span>
          <div className="w-16"></div>
       </div>
       
       <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
          {exportResultUrl && (
             <img src={exportResultUrl} className="max-w-full shadow-2xl rounded-lg" alt="Export Result" />
          )}
       </div>

       <div className="bg-slate-800 p-6 safe-area-bottom flex items-center gap-4 shrink-0">
          <button 
             onClick={handleShare}
             className="flex-1 h-14 bg-slate-700 rounded-2xl flex items-center justify-center gap-2 text-white font-bold active:bg-slate-600 transition-colors"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
             分享
          </button>
          <button 
             onClick={handleDownload}
             className="flex-1 h-14 bg-ios-blue rounded-2xl flex items-center justify-center gap-2 text-white font-bold shadow-lg shadow-blue-900/50 active:scale-95 transition-all"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4-4m4 4v12" /></svg>
             保存相册
          </button>
       </div>
    </div>
  );

  // Existing Renderers (renderToast, renderExitConfirm, etc. - keep largely same)
  const renderToast = () => {
    if (!toastMessage) return null;
    return ( <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[300] bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-sm animate-in fade-in zoom-in duration-200">{toastMessage}</div> );
  };
  const renderExitConfirm = () => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200"><div className="p-8 text-center"><h3 className="font-bold text-xl text-slate-800 mb-4">退出应用</h3><p className="text-slate-500 font-medium text-[15px]">确定要退出 CABIN AUTO MARK 吗？<br/><span className="text-xs text-slate-400 mt-2 block">未导出的照片将会保留在本地。</span></p></div><div className="flex border-t border-slate-100"><button onClick={cancelExit} className="flex-1 h-14 font-bold text-slate-400 active:bg-slate-50 transition-colors text-[17px]">取消</button><div className="w-[1px] bg-slate-100 h-14"></div><button onClick={handleExitApp} className="flex-1 h-14 font-black text-ios-blue active:bg-blue-50 transition-colors text-[17px]">退出</button></div></div></div> );
  const renderClearLogsConfirm = () => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200"><div className="p-8 text-center"><h3 className="font-bold text-xl text-slate-800 mb-4">清空日志</h3><p className="text-slate-500 font-medium text-[15px]">确定要清空所有运行日志吗？<br/>此操作无法撤销。</p></div><div className="flex border-t border-slate-100"><button onClick={() => setShowClearLogsConfirm(false)} className="flex-1 h-14 font-bold text-slate-400 active:bg-slate-50 transition-colors text-[17px]">取消</button><div className="w-[1px] bg-slate-100 h-14"></div><button onClick={executeClearLogs} className="flex-1 h-14 font-black text-ios-red active:bg-red-50 transition-colors text-[17px]">清空</button></div></div></div> );
  const renderInfoModal = () => ( <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200"><div className="p-8"><h3 className="text-center font-bold text-xl text-slate-800 mb-8">登记飞机信息</h3><div className="space-y-6"><div><label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">飞机注册号 ({selectedAircraftId})</label><input type="text" value={tempRegNumber} onChange={(e) => setTempRegNumber(e.target.value.toUpperCase())} placeholder="例如: B-1234" className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 font-bold text-slate-700 focus:border-ios-blue outline-none transition-all" /></div><div><label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">任务性质</label><div className="flex bg-slate-100 p-1.5 rounded-2xl">{(['进场照片', '出场照片'] as const).map((type) => (<button key={type} onClick={() => setTempInspectionType(type)} className={`flex-1 h-11 rounded-xl font-bold transition-all text-[14px] ${tempInspectionType === type ? 'bg-white shadow-md text-ios-blue' : 'text-slate-400 hover:text-slate-600'}`}>{type.replace('照片', '')}</button>))}</div></div></div></div><div className="flex border-t border-slate-100"><button onClick={closeInfo} className="flex-1 h-16 font-bold text-slate-400 active:bg-slate-50">取消</button><div className="w-[1px] bg-slate-100 h-16"></div><button onClick={handleSaveInfo} className="flex-1 h-16 font-black text-ios-blue active:bg-slate-50 active:scale-[0.98] transition-all">保存</button></div></div></div> );
  const renderDeleteConfirm = () => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200"><div className="p-8 text-center"><h3 className="font-bold text-xl text-slate-800 mb-4">确认删除</h3><p className="text-slate-500 font-medium text-[15px]">确定要删除选中的 <span className="text-slate-900 font-bold">{selectedPhotoIds.size}</span> 张照片吗？</p></div><div className="flex border-t border-slate-100"><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-14 font-bold text-slate-400 active:bg-slate-50 transition-colors text-[17px]">取消</button><div className="w-[1px] bg-slate-100 h-14"></div><button onClick={executeBatchDelete} className="flex-1 h-14 font-black text-ios-red active:bg-red-50 transition-colors text-[17px]">删除</button></div></div></div> );
  const renderClearAircraftConfirm = () => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200"><div className="p-8 text-center"><h3 className="font-bold text-xl text-slate-800 mb-4">清空当前机型</h3><p className="text-slate-500 font-medium text-[15px] leading-relaxed">将删除 <span className="font-bold text-slate-900">{selectedAircraftId}</span> 下的所有照片。此操作无法撤销。</p></div><div className="flex border-t border-slate-100"><button onClick={() => setShowClearAircraftConfirm(false)} className="flex-1 h-16 font-bold text-slate-400 active:bg-slate-50 transition-colors text-[17px]">取消</button><div className="w-[1px] bg-slate-100 h-16"></div><button onClick={executeClearAircraftPhotos} className="flex-1 h-16 font-black text-ios-red active:bg-red-50 transition-colors text-[17px]">确认清空</button></div></div></div> );
  const renderExportWarning = () => ( <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"><div className="w-full max-w-xs bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-200"><div className="p-8 text-center"><h3 className="font-bold text-xl text-slate-800 mb-4">信息未登记</h3><p className="text-slate-500 font-medium text-[15px]">导出前请先完善飞机注册号和任务性质。</p></div><div className="flex border-t border-slate-100"><button onClick={() => setShowExportWarning(false)} className="flex-1 h-14 font-bold text-slate-400 active:bg-slate-50 transition-colors text-[17px]">取消</button><div className="w-[1px] bg-slate-100 h-14"></div><button onClick={() => { setShowExportWarning(false); openInfo(); }} className="flex-1 h-14 font-black text-ios-blue active:bg-blue-50 transition-colors text-[17px]">去填写</button></div></div></div> );
  const renderExitedScreen = () => ( <div className="h-full w-full bg-black flex flex-col items-center justify-center text-white p-8 animate-in fade-in duration-700"><div className="w-20 h-20 rounded-full border-2 border-white/20 flex items-center justify-center mb-6"><svg className="w-8 h-8 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></div><h2 className="text-2xl font-bold mb-2">已退出</h2><p className="text-white/40 text-sm text-center">您可以上滑关闭此窗口<br/>或按下 Home 键返回桌面</p></div> );

  // Updated Gallery to use thumbnail
  const renderGallery = () => {
    if (!activeDoor) return null;
    const currentPhotos = doorPhotos;

    return (
      <div className="h-full w-full flex flex-col bg-ios-bg safe-area-bottom">
        <div className="h-16 bg-white border-b border-slate-200 z-20 flex items-center justify-between px-4 shrink-0">
          {isManageMode ? (
             <button onClick={() => { setIsManageMode(false); setSelectedPhotoIds(new Set()); }} className="text-[17px] font-medium text-slate-900 active:opacity-60 pl-1">
               取消
             </button>
          ) : (
             <button onClick={goBack} className="text-ios-blue text-[17px] flex items-center gap-1 font-medium active:opacity-60">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                返回
             </button>
          )}
          
          <span className="font-bold text-[17px] text-slate-900 absolute left-1/2 -translate-x-1/2">{activeDoor.label}</span>
          
          <div className="w-16 flex justify-end">
            {!isManageMode && currentPhotos.length > 0 && (
              <button 
                onClick={() => setIsManageMode(true)} 
                className="text-[17px] font-medium text-ios-blue active:opacity-60"
              >
                管理
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {currentPhotos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                 <svg className="w-10 h-10 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-[15px] font-medium">暂无照片</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 content-start">
              {currentPhotos.map(photo => (
                <div 
                  key={photo.id} 
                  onClick={() => {
                    if (isManageMode) {
                      togglePhotoSelection(photo.id);
                    } else {
                      setActivePhoto(photo);
                      pushView('FULLSCREEN');
                    }
                  }}
                  className="relative aspect-square bg-slate-100 overflow-hidden"
                >
                  <img src={photo.thumbnail || photo.src} className="w-full h-full object-cover" loading="lazy" />
                  {isManageMode && (
                    <div className="absolute inset-0 bg-black/10 flex items-end justify-end p-2">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedPhotoIds.has(photo.id) ? 'bg-ios-blue border-ios-blue' : 'bg-white/50 border-white'}`}>
                        {selectedPhotoIds.has(photo.id) && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Bottom Action Bar */}
        <div className="bg-white/90 backdrop-blur-md border-t border-slate-200 px-4 py-2 safe-area-bottom shrink-0">
           {isManageMode ? (
             <div className="flex items-center justify-between h-14">
               {/* Share Button (Left) */}
               <button 
                 onClick={() => handleUniversalShare(Array.from(selectedPhotoIds) as string[])}
                 disabled={selectedPhotoIds.size === 0}
                 className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-50 disabled:opacity-30 transition-opacity ${selectedPhotoIds.size > 0 ? 'text-ios-blue' : 'text-slate-400'}`}
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                 <span className="text-[10px] font-medium">分享</span>
               </button>
               
               {/* Save Button (Middle) */}
               <button 
                 onClick={() => handleUniversalSave(Array.from(selectedPhotoIds) as string[])}
                 disabled={selectedPhotoIds.size === 0}
                 className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-50 disabled:opacity-30 transition-opacity ${selectedPhotoIds.size > 0 ? 'text-ios-blue' : 'text-slate-400'}`}
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
                 <span className="text-[10px] font-medium">保存</span>
               </button>

               {/* Delete Button (Right) */}
               <button 
                 onClick={handleBatchDelete}
                 disabled={selectedPhotoIds.size === 0}
                 className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-50 disabled:opacity-30 transition-opacity ${selectedPhotoIds.size > 0 ? 'text-ios-red' : 'text-slate-400'}`}
               >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                 <span className="text-[10px] font-medium">删除 ({selectedPhotoIds.size})</span>
               </button>
             </div>
           ) : (
             <div className="flex gap-4 pt-1">
               <button onClick={triggerGallery} className="flex-1 h-12 bg-slate-100 rounded-xl flex items-center justify-center gap-2 text-slate-700 font-bold active:bg-slate-200 transition-colors">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 相册
               </button>
               <button onClick={triggerCamera} className="flex-1 h-12 bg-ios-blue rounded-xl flex items-center justify-center gap-2 text-white font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                 拍摄
               </button>
             </div>
           )}
        </div>
      </div>
    );
  };

  // Updated Fullscreen to wait for full src load
  const renderFullscreen = () => {
    if (!activePhoto) return null;
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-50 animate-in fade-in zoom-in duration-200">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-end pb-6 px-4 justify-between">
           <button onClick={goBack} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
           <span className="text-white/80 font-medium text-sm font-mono tracking-widest">{activePhoto.timestamp.split('T')[0]}</span>
        </div>
        
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {activePhotoFullSrc ? (
              <img src={activePhotoFullSrc} className="max-w-full max-h-full object-contain" />
          ) : (
              <div className="w-12 h-12 border-4 border-white/50 border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent z-10 flex items-start justify-between px-10 pt-8 safe-area-bottom">
           <button 
             onClick={() => {
                 setSelectedPhotoIds(new Set([activePhoto.id]));
                 setShowDeleteConfirm(true);
             }}
             className="flex flex-col items-center gap-2 text-white/80 active:text-white transition-colors group"
           >
             <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-active:bg-red-500/20 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </div>
             <span className="text-xs font-medium">删除</span>
           </button>

           <button 
             onClick={() => handleUniversalSave([activePhoto.id])}
             className="flex flex-col items-center gap-2 text-white/80 active:text-white transition-colors group"
           >
             <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-active:bg-white/20 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v12m0 0l-4-4m4 4l4-4M4 18v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
             </div>
             <span className="text-xs font-medium">保存</span>
           </button>

           <button 
             onClick={() => handleUniversalShare([activePhoto.id])}
             className="flex flex-col items-center gap-2 text-white/80 active:text-white transition-colors group"
           >
             <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-active:bg-white/20 transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
             </div>
             <span className="text-xs font-medium">分享</span>
           </button>
           
           <button 
             onClick={() => startRetakeFlowFromFull(activePhoto)}
             className="flex flex-col items-center gap-2 text-white/80 active:text-white transition-colors group"
           >
             <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-active:bg-white/20 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
             </div>
             <span className="text-xs font-medium">重拍</span>
           </button>
        </div>
      </div>
    );
  };

  // Other Renderers (Preview, AircraftMap, Home, Settings - largely unchanged but included for completeness logic)
  const renderPreview = () => ( <div className="fixed inset-0 bg-black flex flex-col z-[60]"><div className="flex-1 flex items-center justify-center relative bg-black">{tempPhoto && <img src={tempPhoto} className="max-w-full max-h-full object-contain" />}</div><div className="h-28 bg-black/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-between px-8 safe-area-bottom shrink-0"><button onClick={handleRetakeInPreview} className="text-white font-medium text-[17px] active:opacity-60">重拍</button><button onClick={saveReplacement} className="text-black bg-white px-6 py-2.5 rounded-full font-bold text-[17px] active:scale-95 transition-all">使用照片</button></div></div> );
  
  const renderAircraftMap = () => {
    const config = currentAircraft;
    const aircraftPhotos = photos.filter(p => p.aircraftType === selectedAircraftId);
    const isInfoComplete = !!regNumber && !!inspectionType;
    const hasPhotos = aircraftPhotos.length > 0;
    const canExport = isInfoComplete && hasPhotos;

    return (
      <div className="h-full w-full flex flex-col overflow-hidden bg-ios-bg">
        <div className="h-16 bg-white border-b border-slate-200 z-20 flex items-center justify-between px-4 pt-2 shrink-0">
          <button onClick={goBack} className="text-ios-blue text-[17px] flex items-center gap-1 font-medium active:opacity-60">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
            首页
          </button>
          <div className="flex flex-col items-center">
            <h2 className="font-bold text-[18px] text-slate-900 leading-none mb-1">{config.label} {regNumber ? `(${regNumber})` : ''}</h2>
            {isInfoComplete ? (
               <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md"><svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg><span className="text-[10px] text-emerald-600 font-bold tracking-widest">已登记飞机信息</span></div>
            ) : (
               <button onClick={openInfo} className="animate-pulse bg-red-50 px-2 py-0.5 rounded-md border border-red-100"><span className="text-[10px] text-red-500 font-black tracking-widest">请登记飞机信息</span></button>
            )}
          </div>
          <div className="w-12 flex justify-end">
            <button onClick={handleClearAircraftPhotos} disabled={!hasPhotos} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${hasPhotos ? 'bg-red-50 text-ios-red active:bg-red-100' : 'opacity-30 pointer-events-none text-slate-400 bg-slate-100'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center p-6">
          <div className="relative h-full w-full max-w-md bg-white rounded-[48px] shadow-sm border border-slate-100 flex items-center justify-center">
            <svg className="h-[92%] w-full" viewBox="0 0 300 800" preserveAspectRatio="xMidYMid meet" fill="none">
              <defs>
                <linearGradient id="planeGradient" x1="0" y1="0" x2="0" y2="800" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#f97316" /><stop offset="20%" stopColor="#eab308" /><stop offset="40%" stopColor="#22c55e" /><stop offset="60%" stopColor="#06b6d4" /><stop offset="80%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#a855f7" /></linearGradient>
              </defs>
              <path d={config.fuselagePath} stroke="url(#planeGradient)" strokeWidth="6" />
              <path d="M150 100 L150 700" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="10,10" />
              <path d="M100 200 L200 200 M100 400 L200 400 M100 600 L200 600" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="5,5" />
              <g transform={`translate(0, ${config.wingY || 0})`}><path d="M80 350L5 420L5 520L80 450" stroke="url(#planeGradient)" strokeWidth="5" strokeLinejoin="round" /><path d="M220 350L295 420L295 520L220 450" stroke="url(#planeGradient)" strokeWidth="5" strokeLinejoin="round" /></g>
              <g transform={`translate(0, ${config.tailY})`}><path d="M125 710L80 760L80 790L135 755" stroke="url(#planeGradient)" strokeWidth="5" /><path d="M175 710L220 760L220 790L165 755" stroke="url(#planeGradient)" strokeWidth="5" /><path d="M150 750L150 810" stroke="url(#planeGradient)" strokeWidth="5" /></g>
            </svg>
            {config.doors.map(door => {
              const count = aircraftPhotos.filter(p => p.doorId === door.id).length;
              const isLeftSide = door.x < 50;
              const isFap = door.id === 'fap';
              let labelPos = isFap ? 'bottom-full mb-3 left-1/2 -translate-x-1/2 items-center' : (isLeftSide ? 'top-1/2 -translate-y-1/2 right-full mr-3 items-end' : 'top-1/2 -translate-y-1/2 left-full ml-3 items-start');
              let textAlign = isFap ? 'text-center' : (isLeftSide ? 'text-right' : 'text-left');
              
              // Handle center aligned items for General view
              if (selectedAircraftId === 'GENERAL') {
                  labelPos = 'bottom-full mb-2 left-1/2 -translate-x-1/2 items-center';
                  textAlign = 'text-center';
              }

              const buttonStyle = count > 0 ? 'bg-emerald-500 border-white text-white' : 'bg-white border-red-500 text-red-500';
              return (
                <button key={door.id} onClick={() => handleDoorClick(door)} style={{ left: `${door.x}%`, top: `${door.y}%` }} className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center transition-all border-2 shadow-xl active:scale-90 z-10 ${buttonStyle}`}>{count > 0 ? <span className="text-[13px] font-bold">{count}</span> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}<div className={`absolute flex flex-col pointer-events-none ${labelPos}`}><span className={`text-[11px] font-black text-slate-700 uppercase tracking-tighter whitespace-nowrap bg-white/95 px-2.5 py-1 rounded-lg shadow-sm border border-slate-100 ${textAlign}`}>{door.watermark}</span></div></button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border-t border-slate-200 p-6 safe-area-bottom flex flex-col gap-4 z-30 shrink-0">
          <div className="flex gap-4">
            <button onClick={openInfo} className={`flex-1 h-14 rounded-2xl font-bold text-[17px] border transition-colors ${isInfoComplete ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>飞机信息</button>
            <button onClick={handleExport} className={`flex-[2] h-14 rounded-2xl font-bold text-[17px] transition-all ${canExport ? 'bg-ios-blue text-white shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400'}`}>导出长图 ({aircraftPhotos.length})</button>
          </div>
        </div>
      </div>
    );
  };

  const renderHome = () => (
    <div className="h-full w-full bg-ios-bg flex flex-col safe-area-bottom overflow-hidden transition-colors duration-300">
      <div className="flex items-start justify-between px-5 pt-5 pb-2 shrink-0 bg-ios-bg z-10">
         <div className="flex flex-col justify-center">
            <h1 className="text-[28px] min-[375px]:text-3xl font-black text-slate-900 tracking-tighter leading-none whitespace-nowrap">CABIN AUTO-MARK</h1>
            <div className="flex items-center gap-2 mt-1.5"><span className="text-ios-gray font-bold text-[12px] tracking-wide uppercase opacity-80">ETA/ETD Automatic Watermark System</span>
            <button 
              onClick={() => { setSettingsView('CHANGELOG'); pushView('SETTINGS'); }}
              className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-500 border border-slate-200 active:bg-slate-200 transition-colors"
            >
              {APP_VERSION}
            </button>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={() => setShowExitConfirm(true)} className="w-10 h-10 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center text-ios-red active:scale-90 transition-all hover:bg-red-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
            <button onClick={openSettings} className="w-10 h-10 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition-all hover:bg-slate-50"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
         </div>
      </div>
      <div className="flex-1 min-h-0 px-3 pb-2 overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-2 grid-rows-3 gap-3">
          {Object.values(AIRCRAFT_CONFIGS).map(config => {
            const count = photos.filter(p => p.aircraftType === config.id).length;
            const hasData = count > 0;
            return (
            <div key={config.id} onClick={() => { setSelectedAircraftId(config.id); pushView('AIRCRAFT_MAP'); }} className={`group relative rounded-[24px] w-full h-full transition-all duration-300 cursor-pointer flex flex-col items-center justify-center overflow-hidden ${hasData ? 'bg-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.1)] border border-ios-blue/20' : 'bg-white shadow-sm border border-slate-100'} active:scale-[0.98]`}>
              <div className="absolute top-3 right-3 z-20">{hasData && (<div className="relative flex items-center justify-center w-[26px] h-[26px]"><div className="absolute inset-0 rounded-full border-[3px] border-[#FF3B30] animate-breathe-ring"></div><div className="relative w-full h-full bg-white rounded-full flex items-center justify-center border border-[#FF3B30] z-10 shadow-sm"><span className="text-[13px] font-black text-[#FF3B30] leading-none translate-y-[0.5px]">{count}</span></div></div>)}</div>
              <div className={`w-20 h-20 rounded-[22px] flex items-center justify-center text-5xl shadow-lg shadow-slate-100 mb-3 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 bg-gradient-to-br ${config.color}`}><span className="filter drop-shadow-sm">{config.emoji}</span></div>
              <div className="flex flex-col items-center px-1"><h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1.5 text-center">{config.label}</h3><div className={`h-1 rounded-full transition-all duration-500 ease-out ${hasData ? 'w-6 bg-ios-blue' : 'w-2 bg-slate-100 group-hover:w-4 group-hover:bg-slate-200'}`}></div></div>
            </div>
          )})}
        </div>
        <div className="shrink-0 flex flex-col items-center justify-center pb-4 pt-2 opacity-40">
          <p className="text-[10px] text-slate-400 font-bold font-mono">© 802711</p>
        </div>
      </div>
    </div>
  );

  const renderSettingsPage = () => {
    // ... keep settings logic mostly same but use new CHANGELOG
    const renderSettingsMain = () => (<div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-6"><section><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-4">关于</h3><div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 divide-y divide-slate-50"><button onClick={() => setSettingsView('CHANGELOG')} className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors"><span className="font-medium text-slate-700">更新日志</span><svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button><button onClick={() => setSettingsView('GUIDE')} className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors"><span className="font-medium text-slate-700">使用说明</span><svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button></div></section><section><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-4">调试</h3><div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100"><button onClick={() => setSettingsView('LOGS')} className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors"><span className="font-medium text-slate-700">运行日志</span><div className="flex items-center gap-2"><span className="text-xs text-slate-400">{Logger.getLogs().length} 条记录</span><svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></div></button></div></section><div className="pt-8 text-center"><p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.2em] mb-1">CLD AUTO MARK SYSTEM</p><p className="text-[10px] text-slate-300">Designed by Cloud Rui Peng</p></div></div>);
    const renderChangelog = () => (<div className="flex-1 overflow-y-auto bg-slate-50 p-4"><div className="space-y-4">{CHANGELOG.map((log, index) => (<div key={index} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><span className="font-black text-slate-800 text-lg">{log.version}</span>{index === 0 && <span className="bg-ios-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded">NEW</span>}</div><span className="text-xs font-mono text-slate-400">{log.date}</span></div><p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{log.content}</p></div>))}</div></div>);
    const renderLogs = () => { const logs = Logger.getLogs(); return (<div className="flex-1 flex flex-col bg-slate-900 overflow-hidden"><div className="h-12 bg-slate-800 flex items-center justify-end px-4 gap-3 shrink-0"><button onClick={handleCopyLogs} className="text-xs font-bold text-ios-blue hover:text-blue-400 px-3 py-1.5 rounded-lg active:bg-slate-700">复制</button><button onClick={() => setShowClearLogsConfirm(true)} className="text-xs font-bold text-ios-red hover:text-red-400 px-3 py-1.5 rounded-lg active:bg-slate-700">清空</button></div><div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5">{logs.length === 0 ? (<div className="text-slate-500 text-center mt-10">暂无日志记录</div>) : (logs.map(log => (<div key={log.id} className="break-all border-b border-slate-800/50 pb-1"><span className="text-slate-500 mr-2">[{log.timestamp.split(' ')[1]}]</span><span className={`font-bold mr-2 ${log.type === 'ERROR' ? 'text-red-400' : log.type === 'SUCCESS' ? 'text-emerald-400' : log.type === 'WARN' ? 'text-amber-400' : 'text-blue-400'}`}>{log.type}</span><span className="text-slate-300 font-bold mr-2">[{log.action}]</span><span className="text-slate-400">{log.details}</span></div>)))}</div></div>); };
    const renderGuide = () => (
        <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 pb-10 space-y-8">
             <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-blue-50 text-ios-blue flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg></div><h4 className="font-bold text-slate-800 text-lg">1. 首页与信息登记</h4></div><div className="space-y-4"><p className="text-sm text-slate-600 leading-relaxed">进入首页后，请先点击对应的机型卡片进入工作区。系统会自动保存您的机型选择。</p><div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r-lg"><h5 className="text-xs font-bold text-yellow-700 mb-1 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>重要提示</h5><p className="text-xs text-yellow-800 leading-tight">工作开始前，请务必点击左下角的<span className="font-bold">「飞机信息」</span>按钮，准确填写<span className="font-bold">飞机注册号</span>（如 B-1234）和<span className="font-bold">任务性质</span>。否则无法进行长图导出。</p></div></div></section>
             <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div><h4 className="font-bold text-slate-800 text-lg">2. 拍摄与水印</h4></div><div className="space-y-3"><p className="text-sm text-slate-600 leading-relaxed">在机型平面图上，点击对应的舱门位置（圆点）。</p><ul className="list-disc pl-5 space-y-1 text-sm text-slate-600"><li><span className="font-bold text-slate-800">拍摄：</span>直接调用相机拍照。</li><li><span className="font-bold text-slate-800">相册：</span>从系统图库选择已有照片。</li><li><span className="font-bold text-slate-800">自动水印：</span>照片导入后，系统会自动添加带有舱门名称（如 L1, R2）的红色角标水印。</li></ul></div></section>
             <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div><h4 className="font-bold text-slate-800 text-lg">3. 预览与重拍</h4></div><div className="space-y-4"><p className="text-sm text-slate-600 leading-relaxed">在照片列表中点击任意照片可查看大图。</p><div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl"><div className="w-16 h-10 bg-black/80 rounded-lg flex items-center justify-center shrink-0"><span className="text-[10px] text-white font-medium flex flex-col items-center"><svg className="w-3 h-3 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>重拍</span></div><div><h6 className="text-xs font-bold text-slate-800 mb-1">单张重拍功能</h6><p className="text-xs text-slate-500">在大图预览右下角点击「重拍」，可以替换当前这张照片，并<span className="text-ios-blue font-bold">保持原有的排序位置</span>。这在发现照片模糊需要补拍时非常有用。</p></div></div></div></section>
             <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg></div><h4 className="font-bold text-slate-800 text-lg">4. 导出与数据</h4></div><div className="space-y-4"><p className="text-sm text-slate-600 leading-relaxed">所有照片拍摄完毕后，点击底部的<span className="font-bold text-slate-900">「导出长图」</span>。</p><div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r-lg"><h5 className="text-xs font-bold text-red-700 mb-1">关于数据安全</h5><p className="text-xs text-red-800 leading-tight">本应用所有数据（照片、信息）均存储在您的<span className="font-bold">手机本地浏览器数据库</span>中，不会上传到任何云端服务器。<br/><br/>⚠️ <span className="font-bold">请勿随意清除浏览器缓存</span>，否则可能会导致未导出的照片丢失。建议工作完成后及时导出图片保存到系统相册。</p></div></div></section>
             <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"><div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><h4 className="font-bold text-slate-800 text-lg">5. 故障排除 (重要)</h4></div><div className="space-y-4"><div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><h6 className="text-sm font-bold text-slate-800 mb-1">软件运行异常</h6><p className="text-xs text-slate-500 leading-relaxed">如果遇到操作无反应、卡顿等问题，请直接<span className="font-bold text-slate-700">关闭后台</span>或<span className="font-bold text-slate-700">关闭浏览器标签页</span>后重新打开。此操作<span className="font-bold text-emerald-600">不会删除</span>已保存的数据。</p></div><div className="bg-red-50 p-3 rounded-lg border border-red-100"><h6 className="text-sm font-bold text-red-700 mb-1 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>界面显示异常</h6><p className="text-xs text-red-800 leading-relaxed">如果打开后出现界面错乱、无法加载等严重问题，请尝试<span className="font-bold">清空浏览器缓存</span>后重试。⚠️ <span className="font-bold">注意：清空缓存将会彻底删除所有已保存但未导出的数据！</span></p></div></div></section>
          </div>
        </div>
    );
    let title = '设置'; if (settingsView === 'CHANGELOG') title = '更新日志'; else if (settingsView === 'LOGS') title = '运行日志'; else if (settingsView === 'GUIDE') title = '使用说明';
    return (<div className="h-full w-full flex flex-col bg-slate-50 safe-area-bottom z-40 animate-in slide-in-from-right duration-300"><div className={`h-16 border-b z-20 flex items-center justify-between px-4 shrink-0 transition-colors ${settingsView === 'LOGS' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}><button onClick={handleSettingsBack} className="flex items-center gap-1 font-medium active:opacity-60 text-[17px] text-ios-blue"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>{settingsView === 'MAIN' ? '首页' : '返回'}</button><span className="font-bold text-[17px] absolute left-1/2 -translate-x-1/2">{title}</span><div className="w-16"></div></div>{settingsView === 'MAIN' && renderSettingsMain()}{settingsView === 'CHANGELOG' && renderChangelog()}{settingsView === 'LOGS' && renderLogs()}{settingsView === 'GUIDE' && renderGuide()}</div>);
  };

  return (
    <main className="h-[100dvh] w-full select-none overflow-hidden flex flex-col bg-ios-bg transition-colors duration-300">
      {view === 'HOME' && renderHome()}
      {view === 'EXITED' && renderExitedScreen()}
      {view === 'AIRCRAFT_MAP' && renderAircraftMap()}
      {view === 'GALLERY' && renderGallery()}
      {view === 'FULLSCREEN' && renderFullscreen()}
      {view === 'PREVIEW' && renderPreview()}
      {view === 'SETTINGS' && renderSettingsPage()}
      {view === 'EXPORT_RESULT' && renderExportResult()}
      
      <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" onClick={(e) => (e.currentTarget.value = '')} onChange={handleFileChange} className="hidden" />
      <input type="file" ref={galleryInputRef} accept="image/*" onClick={(e) => (e.currentTarget.value = '')} onChange={handleFileChange} className="hidden" />

      {showInfoModal && renderInfoModal()}
      {showDeleteConfirm && renderDeleteConfirm()}
      {showClearAircraftConfirm && renderClearAircraftConfirm()}
      {showExportWarning && renderExportWarning()}
      {showExitConfirm && renderExitConfirm()}
      {showClearLogsConfirm && renderClearLogsConfirm()}
      {renderToast()}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[200] flex flex-col items-center justify-center" style={{touchAction: 'none'}}>
          <div className="bg-white/90 p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-ios-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-800 font-bold tracking-tight">{loadingText}</p>
          </div>
        </div>
      )}
    </main>
  );
};
