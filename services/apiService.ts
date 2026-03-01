import { GenerationConfig, LogEntry } from '../types';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to safely extract error message
const getErrorMessage = (error: any): string => {
  if (!error) return "Unknown Error";
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  
  // Handle objects that might have message or error properties
  if (typeof error === 'object') {
     if (error.message) return String(error.message);
     if (error.error) return String(error.error);
     // If it's a plain object, try to stringify it
     try {
       return JSON.stringify(error);
     } catch (e) {
       return "Object (circular or non-serializable)";
     }
  }
  return String(error);
}

// Helper function to poll the status of the task
const pollTaskStatus = async (
  taskId: string, 
  apiKey: string, 
  onLog: (log: LogEntry) => void
): Promise<any> => {
  const maxAttempts = 120; // Try for about 6 minutes (120 * 3s)
  const interval = 3000; // 3 seconds

  const myHeaders = new Headers();
  myHeaders.append("Accept", "application/json");
  myHeaders.append("Authorization", `Bearer ${apiKey}`);

  const requestOptions: RequestInit = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
  };

  for (let i = 0; i < maxAttempts; i++) {
    await wait(interval);

    try {
      const response = await fetch(`https://api.apizoo.top/v1/videos/${taskId}`, requestOptions);
      const responseText = await response.text(); // Read text first for debugging/error checking

      // Check for Fatal Errors in raw text (e.g. if API returns plain text error or 4xx with body)
      const lowerText = responseText.toLowerCase();

      // Specific Check for Sexual Content Error to provide better message
      if (lowerText.includes("public_error_sexual")) {
         throw new Error("Generation Failed: Content blocked by safety filters (Sexual/NSFW). \n生成失败：内容因涉及敏感信息（色情/性）被安全过滤器拦截。");
      }

      if (lowerText.includes("public_error_audio_filtered")) {
         throw new Error("Generation Failed: Content blocked by safety filters (Audio Filtered). \n生成失败：触发了音频安全过滤（PUBLIC_ERROR_AUDIO_FILTERED），请尝试修改提示词或更换图片。");
      }

      if (
          lowerText.includes("public_error") || 
          lowerText.includes("sexual") || 
          lowerText.includes("nsfw") ||
          lowerText.includes("safety_check")
      ) {
         throw new Error(`Fatal API Error: ${responseText}`);
      }

      // Handle HTTP Errors
      if (!response.ok) {
        // 401/403 are fatal authentication errors
        if (response.status === 401 || response.status === 403) {
            throw new Error(`HTTP Authentication Error: ${response.status} ${response.statusText}`);
        }
        // 404 might mean task not found yet (eventual consistency) or wrong ID. 
        // We'll retry a few times but if it persists... (logic handled by loop limit)
        
        onLog({
          timestamp: new Date().toLocaleTimeString(),
          message: `Polling HTTP Status: ${response.status}. Retrying...`,
          type: 'warning'
        });
        continue;
      }

      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        // If 200 OK but not JSON, and not caught by fatal check above
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
      }
      
      // Check for API-level Error Codes in JSON
      if (result.code !== undefined && result.code !== 0 && result.code !== 200) {
         throw new Error(result.message || `API Error Code: ${result.code}`);
      }

      // Explicit check for 'message' field indicating failure
      if (typeof result.message === 'string') {
          const upperMsg = result.message.toUpperCase();
          
          if (upperMsg.includes('PUBLIC_ERROR_SEXUAL')) {
             throw new Error("Generation Failed: Content blocked by safety filters (Sexual/NSFW). \n生成失败：内容因涉及敏感信息（色情/性）被安全过滤器拦截。");
          }

          if (upperMsg.includes('PUBLIC_ERROR_AUDIO_FILTERED')) {
             throw new Error("Generation Failed: Content blocked by safety filters (Audio Filtered). \n生成失败：触发了音频安全过滤（PUBLIC_ERROR_AUDIO_FILTERED），请尝试修改提示词或更换图片。");
          }

          // "PUBLIC_ERROR_SEXUAL" contains "ERROR"
          if (upperMsg.includes('ERROR') || upperMsg.includes('FAIL')) {
              throw new Error(result.message);
          }
      }
      
      // Determine Status
      const status = (result.status || result.state || '').toLowerCase();
      const progress = result.progress ? ` (${result.progress}%)` : '';

      if (status === 'succeeded' || status === 'completed') {
        onLog({
          timestamp: new Date().toLocaleTimeString(),
          message: `Task Finished!`,
          type: 'success'
        });
        return result; 
      } else if (status === 'failed' || status === 'error') {
        throw new Error(result.message || result.error || "Task failed on server.");
      } else {
        // Still processing
        if (i % 3 === 0) { 
            onLog({
            timestamp: new Date().toLocaleTimeString(),
            message: `Task is ${status || 'processing'}...${progress}`,
            type: 'info'
            });
        }
      }

      // Early exit if video_url exists
      if (result.output?.video_url || result.video_url || result.url) {
        return result;
      }

    } catch (error: any) {
      const errMsg = getErrorMessage(error);
      const lowerMsg = errMsg.toLowerCase();

      // STOP POLLING IMMEDIATELY for these specific errors
      if (
          lowerMsg.includes("public_error") || 
          lowerMsg.includes("sexual") || 
          lowerMsg.includes("safety") || 
          lowerMsg.includes("nsfw") ||
          lowerMsg.includes("illegal") ||
          lowerMsg.includes("http authentication error") || 
          lowerMsg.includes("fatal api error") || 
          lowerMsg.includes("生成失败") // Catch our custom message
      ) {
         throw error; // Rethrow to exit the loop and fail the task
      }

      console.error("Polling error", error);
      onLog({
        timestamp: new Date().toLocaleTimeString(),
        message: `Polling check warning: ${errMsg}`,
        type: 'warning'
      });
    }
  }

  throw new Error("Timeout: Video generation took too long.");
};

export const generateVideo = async (
  config: GenerationConfig,
  onLog: (log: LogEntry) => void
): Promise<any> => {
  const myHeaders = new Headers();
  myHeaders.append("Authorization", `Bearer ${config.apiKey}`);

  const formdata = new FormData();
  formdata.append("model", config.model);
  formdata.append("prompt", config.prompt);
  formdata.append("seconds", config.seconds);
  formdata.append("size", config.size);
  formdata.append("watermark", config.watermark);

  if (config.startImage) {
    onLog({
      timestamp: new Date().toLocaleTimeString(),
      message: `Uploading start frame: ${config.startImage.name}`,
      type: 'info'
    });
    formdata.append("input_reference", config.startImage);
  }

  if (config.endImage) {
    const paramName = config.endFrameParamName || "input_reference";
    onLog({
      timestamp: new Date().toLocaleTimeString(),
      message: `Uploading end frame: ${config.endImage.name}`,
      type: 'info'
    });
    formdata.append(paramName, config.endImage); 
  }

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: myHeaders,
    body: formdata,
    redirect: 'follow'
  };

  onLog({
    timestamp: new Date().toLocaleTimeString(),
    message: 'Submitting task...',
    type: 'info'
  });

  let initialResponse;
  try {
    const response = await fetch("https://api.apizoo.top/v1/videos", requestOptions);
    const text = await response.text();
    
    if (!response.ok) {
        throw new Error(`Submission Failed (${response.status}): ${text}`);
    }
    
    try {
        initialResponse = JSON.parse(text);
    } catch(e) {
        throw new Error(`Invalid JSON response from submission: ${text}`);
    }

  } catch (error: any) {
    onLog({ timestamp: new Date().toLocaleTimeString(), message: `Submit Error: ${getErrorMessage(error)}`, type: 'error' });
    throw error;
  }

  const taskId = initialResponse.id || initialResponse.task_id;

  if (taskId) {
    onLog({
        timestamp: new Date().toLocaleTimeString(),
        message: `Task Submitted. ID: ${taskId}`,
        type: 'success'
    });
    return await pollTaskStatus(taskId, config.apiKey, onLog);
  } else if (initialResponse.output?.video_url || initialResponse.data) {
    return initialResponse;
  } else {
    onLog({
        timestamp: new Date().toLocaleTimeString(),
        message: `Warning: No Task ID.`,
        type: 'warning'
    });
    return initialResponse;
  }
};