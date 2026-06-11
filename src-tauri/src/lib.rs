// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 메뉴바(트레이) 아이콘 + 보이기/숨기기 토글 메뉴를 구성한다.
#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::TrayIconBuilder,
        Manager,
    };

    // 창이 보이는 상태로 시작하므로 토글 라벨은 "숨기기".
    let toggle_i = MenuItem::with_id(app, "toggle", "숨기기", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle_i, &separator, &quit_i])?;

    // 메뉴 이벤트 핸들러에서 라벨을 갱신하기 위해 토글 항목 핸들을 복제해 넘긴다.
    let toggle_handle = toggle_i.clone();

    TrayIconBuilder::with_id("ssagal-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("쌰갈")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "toggle" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                        let _ = toggle_handle.set_text("보이기");
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = toggle_handle.set_text("숨기기");
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            #[cfg(desktop)]
            setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
