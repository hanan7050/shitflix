import { getDetails, getTitle, getMapping } from '../api.js';
import { createVideoPlayer } from '../components/VideoPlayer.js';

export async function renderPlayer(container, params) {
  container.innerHTML = '';
  
  const nav = document.querySelector('.sf-nav');
  if (nav) nav.classList.add('sf-nav-hidden');

  let playerCleanup = null;

  try {
    const details = await getDetails(params.id, params.type);
    const title = getTitle(details);
    
    let season = null;
    let episode = null;
    let mapping = null;
    
    if (params.type === 'tv') {
        mapping = await getMapping(params.id, params.type);
        if (mapping && mapping.seasons) {
            const seasons = Object.keys(mapping.seasons).sort((a,b) => parseInt(a)-parseInt(b));
            if (seasons.length > 0) {
                season = seasons[0];
                const episodes = Object.keys(mapping.seasons[season].episodes).sort((a,b) => parseInt(a)-parseInt(b));
                if (episodes.length > 0) {
                    episode = episodes[0];
                }
            }
        }
    }
    
    const { element, cleanup } = createVideoPlayer(params.id, params.type, title, season, episode);
    playerCleanup = cleanup;
    container.appendChild(element);
    
    if (params.type === 'tv' && mapping && mapping.seasons) {
        const selectorContainer = document.createElement('div');
        selectorContainer.style.padding = '20px';
        selectorContainer.style.background = '#141414';
        selectorContainer.style.color = '#fff';
        
        let html = '<h3 style="margin-bottom: 15px; font-size: 20px;">Episodes</h3>';
        
        for (const s of Object.keys(mapping.seasons).sort((a,b) => parseInt(a)-parseInt(b))) {
            html += `<h4 style="margin: 15px 0 10px; color: #aaa;">Season ${s}</h4>`;
            html += `<div style="display: flex; flex-wrap: wrap; gap: 10px;">`;
            for (const e of Object.keys(mapping.seasons[s].episodes).sort((a,b) => parseInt(a)-parseInt(b))) {
                const isActive = (s === season && e === episode);
                html += `<button class="sf-episode-btn" data-season="${s}" data-episode="${e}" tabindex="0" style="
                    background: ${isActive ? '#e50914' : '#333'}; 
                    color: white; 
                    border: none; 
                    padding: 8px 16px; 
                    border-radius: 4px; 
                    cursor: pointer;
                    font-size: 14px;
                    transition: background 0.2s, box-shadow 0.2s;
                    outline: none;
                " onfocus="this.style.boxShadow='0 0 0 3px white'" onblur="this.style.boxShadow='none'" onmouseover="this.style.background='${isActive ? '#f40612' : '#444'}'" onmouseout="this.style.background='${isActive ? '#e50914' : '#333'}'">Ep ${e}</button>`;
            }
            html += `</div>`;
        }
        
        selectorContainer.innerHTML = html;
        container.appendChild(selectorContainer);
        
        selectorContainer.querySelectorAll('.sf-episode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newSeason = e.target.getAttribute('data-season');
                const newEpisode = e.target.getAttribute('data-episode');
                // Cleanup old player
                if (playerCleanup) playerCleanup();
                
                // Remove old player element
                element.remove();
                selectorContainer.remove();
                
                // Render new player
                const newPlayer = createVideoPlayer(params.id, params.type, title, newSeason, newEpisode);
                playerCleanup = newPlayer.cleanup;
                container.insertBefore(newPlayer.element, container.firstChild);
                
                // Re-append selector
                container.appendChild(selectorContainer);
                
                // Update active state
                selectorContainer.querySelectorAll('.sf-episode-btn').forEach(b => b.style.background = '#333');
                e.target.style.background = '#e50914';
            });
        });
    }
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div style="padding: 100px; text-align: center; color: white;">Failed to load player. <button onclick="window.history.back()" style="margin-top:20px; padding:10px 20px; background:white; color:black; border:none; border-radius:4px; cursor:pointer;">Go Back</button></div>';
  }

  return () => {
    if (nav) nav.classList.remove('sf-nav-hidden');
    if (playerCleanup) playerCleanup();
  };
}
