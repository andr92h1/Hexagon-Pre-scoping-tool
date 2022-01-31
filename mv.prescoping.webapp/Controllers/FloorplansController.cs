using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using mv.prescoping.db;

namespace mv.prescoping.webapp.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class FloorplansController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FloorplansController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/Floorplans
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Floorplan>>> GetFloorplans(long? entityId, int? code)
        {
            if (entityId == null && code == null)
            {
                BadRequest();
            }

            return await _context.Floorplans.Where(x => (entityId == null || x.EntityId == entityId) && (code == null || x.Code == code)).ToListAsync();
        }

        // GET: api/Floorplans/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Floorplan>> GetFloorplan(string id)
        {
            var floorplan = await _context.Floorplans.FindAsync(id);

            if (floorplan == null)
            {
                return NotFound();
            }

            return floorplan;
        }

        // PUT: api/Floorplans/5
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPut("{id}")]
        public async Task<IActionResult> PutFloorplan(string id, Floorplan floorplan)
        {
            if (id != floorplan.Id)
            {
                return BadRequest();
            }

            _context.Entry(floorplan).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FloorplanExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Floorplans
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<Floorplan>> PostFloorplan(Floorplan floorplan)
        {
            _context.Floorplans.Add(floorplan);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                if (FloorplanExists(floorplan.Id))
                {
                    return Conflict();
                }
                else
                {
                    throw;
                }
            }

            return CreatedAtAction("GetFloorplan", new { id = floorplan.Id }, floorplan);
        }

        // DELETE: api/Floorplans/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFloorplan(string id)
        {
            var floorplan = await _context.Floorplans.FindAsync(id);
            if (floorplan == null)
            {
                return NotFound();
            }

            _context.Floorplans.Remove(floorplan);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private bool FloorplanExists(string id)
        {
            return _context.Floorplans.Any(e => e.Id == id);
        }
    }
}
