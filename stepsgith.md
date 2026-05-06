Paso a paso de lo que hice                                                                  
                                                                                                1. Revisé el estado del repo                                                                
  git status                                                                                  
  git branch -a
  git diff --stat
  git log --oneline -10
  Había 6 archivos sin commitear en mejoras: ruleta movida a tab de admin, nuevo tab de       
  configuración de menú, y normalización de fechas en AppContext.

  2. Stageé y commiteé los cambios pendientes en mejoras
  git add app/admin/page.jsx app/admin/NavConfigTab.jsx app/admin/RuletaTab.jsx \
          app/ruleta/page.jsx components/Header.jsx context/AppContext.jsx
  git commit -m "Mover Ruleta a tab de Admin y agregar config de menú"
  Commit: db8425f

  3. Pusheé la rama mejoras al remoto
  git push origin mejoras

  4. Cambié a main y traje los últimos cambios
  git checkout main
  git pull origin main

  5. Mergeé mejoras en main con merge commit (no fast-forward) para preservar el historial    
  git merge mejoras --no-ff -m "Merge branch 'mejoras' into main"
  Resultado: 12 archivos cambiados, 1168 inserciones, 31 borrados.

  6. Pusheé main al remoto
  git push origin main
  9a5048e..05220a5 main -> main

  7. Volví a la rama mejoras
  git checkout mejoras

  Ambas ramas quedaron sincronizadas con GitHub.