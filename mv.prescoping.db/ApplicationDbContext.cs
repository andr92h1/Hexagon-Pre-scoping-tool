using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace mv.prescoping.db
{
    public class ApplicationDbContext : IdentityDbContext
    {
        public DbSet<Entity> Entities { get; set; }
        public DbSet<EntityType> EntityTypes { get; set; }
        public DbSet<Stage> Stages { get; set; }
        public DbSet<StageType> StageTypes { get; set; }
        public DbSet<Floorplan> Floorplans { get; set; }
        public DbSet<Photo> Photos { get; set; }
        public DbSet<Annotation> Annotations { get; set; }

        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            builder.Entity<Entity>().HasOne(e => e.Parent).WithMany(e => e.Children).OnDelete(DeleteBehavior.Cascade);
            builder.Entity<Entity>().HasOne(e => e.Type).WithMany(t => t.Entities).OnDelete(DeleteBehavior.Restrict);
            builder.Entity<Stage>().HasOne(s => s.Type).WithMany(t => t.Stages).OnDelete(DeleteBehavior.Restrict);
            builder.Entity<Stage>().HasOne(e => e.PlannedStage).WithMany(e => e.ActualStages).OnDelete(DeleteBehavior.Restrict);
            builder.Entity<Photo>().HasOne(p => p.Floorplan).WithMany(f => f.Photos).OnDelete(DeleteBehavior.Restrict);
            builder.Entity<Photo>().HasIndex(p => p.Status);
            builder.Entity<Annotation>().Property(p => p.Source).HasConversion<int>();
            builder.Entity<Annotation>().Property(p => p.ConfidentLevel).HasDefaultValue(1.0);
            builder.Entity<Annotation>().Property(p => p.IsPassedValidation).HasDefaultValue(false);
            builder.Entity<Annotation>().Property(p => p.IsDeleted).HasDefaultValue(false);
            builder.Entity<Annotation>().Property(p => p.IsClassChanged).HasDefaultValue(false);
            builder.Entity<Annotation>().Property(p => p.IsGeometryChanged).HasDefaultValue(false);
            builder.Entity<Annotation>().HasOne(a => a.Photo).WithMany(p => p.Annotations).OnDelete(DeleteBehavior.Cascade);
            builder.Entity<Annotation>().HasOne(a => a.Stage).WithMany(s => s.Annotations).OnDelete(DeleteBehavior.SetNull);
            builder.Entity<Annotation>().HasOne(a => a.Entity).WithMany(e => e.Annotations).OnDelete(DeleteBehavior.SetNull);

            base.OnModelCreating(builder);
        }

        public static ApplicationDbContext CreateDbContext(string connectionString)
        {
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
            optionsBuilder.UseNpgsql(connectionString, x => x.UseNetTopologySuite());
            return new ApplicationDbContext(optionsBuilder.Options);
        }
    }
}
